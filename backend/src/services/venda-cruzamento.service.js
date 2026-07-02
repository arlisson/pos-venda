const Busboy = require('busboy');
const ExcelJS = require('exceljs');

const LIMITE_VALORES_DISTINTOS = 50;
const LIMITE_AMOSTRAS = 5;
// Tolerancia (R$) por chip na comparacao de valores, para absorver arredondamentos.
const TOLERANCIA_VALOR = 0.05;
// Rede de seguranca da busca por combinacoes de chips (grupos sao pequenos; isso evita
// explosao combinatoria se um cliente tiver um volume atipico de chips).
const LIMITE_ITERACOES_SUBCONJUNTO = 100000;
// Rede de seguranca, nao teto de uso normal: evita derrubar o processo se alguem
// subir o arquivo errado (um video, um dump). Ajustavel via CRUZAMENTO_LIMITE_BYTES.
const LIMITE_TAMANHO_ARQUIVO_PADRAO = 50 * 1024 * 1024; // 50 MB

/**
 * Limite de bytes por arquivo, lido a cada chamada para permitir override por ambiente.
 */
function limiteTamanhoArquivo() {
  const configurado = Number(process.env.CRUZAMENTO_LIMITE_BYTES);
  return Number.isFinite(configurado) && configurado > 0 ? configurado : LIMITE_TAMANHO_ARQUIVO_PADRAO;
}

function megabytes(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/**
 * Cria um erro HTTP com statusCode para ser tratado pelo controller.
 */
function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Normaliza texto para comparacao (sem acento, minusculo, sem espacos nas pontas).
 */
function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza a chave de cruzamento (Razao Social) para comparacao entre planilhas:
 * remove acentos, ignora caixa e colapsa espacos repetidos.
 */
function normalizarChave(valor) {
  return normalizarTexto(valor).replace(/\s+/g, ' ');
}

function normalizarDocumento(valor) {
  return String(valor || '').replace(/\D/g, '');
}

/**
 * Converte um valor de celula (texto/numero, com virgula ou ponto) em numero; 0 se invalido.
 */
function paraNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Detecta automaticamente as colunas de contas/chips de uma operadora pelo padrao do nome
 * (ex.: Claro "Ctns ..."). Vazio quando nao ha (ex.: Vivo, que conta 1 chip por linha).
 */
function detectarColunasChips(nomes = []) {
  return nomes.filter(nome => !String(nome).startsWith('__') && /\bctns\b|contas|chips/i.test(nome));
}

/**
 * Detecta automaticamente a coluna de quantidade da planilha principal pelo nome.
 */
function detectarColunaQuantidade(nomes = []) {
  return nomes.find(nome => !String(nome).startsWith('__') && /\bquantidade\b|\bqtd\b|chips/i.test(nome)) || '';
}

/**
 * Detecta automaticamente a coluna de status da planilha principal pelo nome.
 */
function detectarColunaStatus(nomes = []) {
  return nomes.find(nome => !String(nome).startsWith('__') && normalizarTexto(nome) === 'status') || '';
}

/**
 * Detecta automaticamente a coluna de valor unitario (por chip) da planilha principal.
 */
function detectarColunaValor(nomes = []) {
  return nomes.find(nome => {
    if (String(nome).startsWith('__')) return false;
    const norm = normalizarTexto(nome);
    return norm === 'valor' || norm.includes('valor da venda') || norm.includes('mensalidade');
  }) || '';
}

/**
 * Detecta automaticamente as colunas de valor de uma planilha de operadora, cuja soma e o
 * total pago na linha (ex.: Claro "Receita Nova/Incrementada/Renovada"; Vivo "VALOR").
 */
function detectarColunasValor(nomes = []) {
  return nomes.filter(nome => {
    if (String(nome).startsWith('__')) return false;
    const norm = normalizarTexto(nome);
    return norm === 'valor' || /receita (nova|incrementada|renovada)/.test(norm) || norm.includes('valor da venda');
  });
}

/**
 * Uma venda esta cancelada quando o STATUS comeca por "cancel" (CANCELADO/CANCELADA/
 * CANCELADO <motivo>) ou menciona credito negado (inclui o erro comum "CREDIO NEGADO").
 */
function vendaCancelada(valorStatus) {
  const texto = normalizarTexto(valorStatus);
  return texto.startsWith('cancel') || texto.includes('negado');
}

/**
 * Cancelamento comunicado em texto livre (OBS e afins). Usa palavra inteira para evitar falsos
 * positivos (ex.: "nao cancelar"): cancelado/cancelada/cancelamento ou credito negado.
 */
function textoIndicaCancelamento(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return false;
  return /\bcancelad[oa]\b|\bcancelamento\b/.test(texto) || /cred\w* negado/.test(texto);
}

/**
 * Devolve o motivo do cancelamento (o texto que disparou) ou '' se a venda nao foi cancelada.
 * Prioriza a coluna STATUS; depois varre as demais colunas de texto (exceto as estruturais).
 */
function motivoCancelamento(dados, colunaStatus, colunasEstruturais) {
  if (colunaStatus && vendaCancelada(dados[colunaStatus])) return dados[colunaStatus] || 'CANCELADO';
  for (const [chave, valor] of Object.entries(dados)) {
    if (chave.startsWith('__') || chave === colunaStatus || colunasEstruturais.has(chave)) continue;
    if (textoIndicaCancelamento(valor)) return `${chave}: ${valor}`;
  }
  return '';
}

/**
 * Quantidade de chips de uma venda da principal. Usa a coluna mapeada em `quantidade`; na falta,
 * a coluna detectada automaticamente (`colunaAuto`). Default 1.
 */
function quantidadePrincipal(dados, mapeamento, colunaAuto = '') {
  let valor;
  if (campoPreenchido(mapeamento, 'quantidade')) {
    valor = valorMapeado(dados, mapeamento, 'quantidade');
  } else if (colunaAuto) {
    valor = dados[colunaAuto];
  } else {
    return 1;
  }
  const qtd = Math.trunc(paraNumero(valor));
  return qtd > 0 ? qtd : 1;
}

/**
 * Quantidade de chips de uma linha de confirmacao da operadora. As planilhas representam isso
 * de formas diferentes: a Claro soma colunas de contas (Ctns ...), a Vivo tem 1 chip por linha.
 * Usa `quantidadeColunas` se mapeado; na falta, as colunas detectadas automaticamente
 * (`colunasAuto`). Sem colunas = 1 chip por linha.
 */
function quantidadeConfirmacao(dados, mapeamento, colunasAuto = []) {
  const colunas = Array.isArray(mapeamento.quantidadeColunas) && mapeamento.quantidadeColunas.length > 0
    ? mapeamento.quantidadeColunas
    : colunasAuto;
  // Sem colunas de contas (ex.: Vivo): 1 chip por linha. Com colunas: a soma (0 = nao confirma).
  if (colunas.length === 0) return 1;
  return colunas.reduce((total, nome) => total + Math.trunc(paraNumero(dados[nome])), 0);
}

/**
 * Valores unitarios dos chips de uma venda da principal (array de tamanho `qtd`).
 * A coluna de valor traz o valor POR CHIP; combos fibra+fixo vem como "84,90 + 30,00"
 * (um valor por item). Retorna null por chip quando o valor nao pode ser interpretado
 * (o chip cai no pareamento por contagem, sem flag de divergencia).
 */
function valoresChipsPrincipal(dados, mapeamento, qtd, colunaAuto = '') {
  let texto;
  if (campoPreenchido(mapeamento, 'valor')) {
    texto = valorMapeado(dados, mapeamento, 'valor');
  } else if (colunaAuto) {
    texto = dados[colunaAuto];
  }
  const partes = String(texto ?? '').split('+').map(parte => parte.trim()).filter(Boolean);
  const valores = partes.map(paraNumero);
  if (valores.length > 0 && valores.every(valor => valor > 0)) {
    // Um valor por item (combo) ou um unico valor unitario replicado para todos os chips.
    if (valores.length === qtd) return valores;
    if (valores.length === 1) return Array(qtd).fill(valores[0]);
  }
  return Array(qtd).fill(null);
}

/**
 * Valor total pago numa linha de confirmacao da operadora: soma de `valorColunas` se mapeado;
 * na falta, das colunas detectadas automaticamente (`colunasAuto`). Retorna null quando nao ha
 * colunas de valor ou nenhuma esta preenchida (linha sem valor nao participa da comparacao).
 */
function valorConfirmacao(dados, mapeamento, colunasAuto = []) {
  const colunas = Array.isArray(mapeamento.valorColunas) && mapeamento.valorColunas.length > 0
    ? mapeamento.valorColunas
    : colunasAuto;
  if (colunas.length === 0) return null;
  const preenchida = colunas.some(nome => String(dados[nome] ?? '').trim() !== '');
  if (!preenchida) return null;
  return colunas.reduce((total, nome) => total + paraNumero(dados[nome]), 0);
}

function encontrarColunaPorTermos(dados, ...termos) {
  const termosNorm = termos.map(normalizarTexto);
  return Object.keys(dados || {}).find(nome => {
    if (nome.startsWith('__')) return false;
    const nomeNorm = normalizarTexto(nome);
    return termosNorm.some(termo => nomeNorm === termo || nomeNorm.includes(termo));
  }) || '';
}

/**
 * Classifica um valor como CPF (11 digitos) ou CNPJ (14 digitos) e devolve a chave de
 * indexacao com prefixo de tipo. O prefixo impede casamento cruzado entre CPF e CNPJ.
 *
 * Planilhas que salvam o documento como NUMERO perdem zeros a esquerda (ex.: a Vivo manda
 * "1327884000156" para "01.327.884/0001-56"). Como CPF (<=11) e CNPJ (>=12) tem faixas de
 * comprimento que nao se sobrepoem, completamos com zeros a esquerda sem ambiguidade:
 * 12-13 digitos = CNPJ; 9-10 digitos = CPF. Um numero de 11 digitos e tratado como CPF.
 *
 * @param {*} valor - Valor cru da celula de documento.
 * @returns {{ tipo: ('cpf'|'cnpj'|null), digitos: string, chave: string }}
 */
function classificarDocumento(valor) {
  const digitos = normalizarDocumento(valor);
  if (digitos.length >= 12) {
    const cnpj = digitos.slice(-14).padStart(14, '0');
    return { tipo: 'cnpj', digitos: cnpj, chave: `cnpj:${cnpj}` };
  }
  if (digitos.length >= 9) {
    const cpf = digitos.padStart(11, '0');
    return { tipo: 'cpf', digitos: cpf, chave: `cpf:${cpf}` };
  }
  return { tipo: null, digitos: '', chave: '' };
}

/**
 * Extrai o documento de uma linha tentando a coluna de CNPJ e, em seguida, a de CPF
 * (a primeira preenchida vence). Na principal so existe uma coluna mista (em `cnpj`);
 * nas operadoras as colunas de CPF e CNPJ vivem em abas distintas ja combinadas.
 *
 * @param {Object} dados - Linha da planilha.
 * @param {Object} [mapeamento] - Mapeamento com `cnpj` e/ou `cpf`.
 * @returns {{ tipo: ('cpf'|'cnpj'|null), digitos: string, chave: string }}
 */
function documentoDaLinha(dados, mapeamento = {}) {
  const campos = ['cnpj', 'cpf'];
  const candidatas = campos.some(campo => mapeamento[campo] || mapeamento[`${campo}Index`])
    ? campos
    : [encontrarColunaPorTermos(dados, 'cnpj', 'cpf/cnpj', 'cnpj/cpf', 'cpf')].filter(Boolean);
  for (const campo of candidatas) {
    const valor = typeof campo === 'string' && !['cnpj', 'cpf'].includes(campo)
      ? dados[campo]
      : valorMapeado(dados, mapeamento, campo);
    const documento = classificarDocumento(valor);
    if (documento.chave) return documento;
  }
  return { tipo: null, digitos: '', chave: '' };
}

function valorMapeado(dados, mapeamento = {}, campo) {
  const nomeColuna = mapeamento[campo];
  if (nomeColuna && Object.prototype.hasOwnProperty.call(dados, nomeColuna)) {
    return dados[nomeColuna];
  }
  const indice = Number(mapeamento[`${campo}Index`]);
  if (Number.isInteger(indice) && indice > 0) {
    return dados.__colunasPorIndice?.[indice] || '';
  }
  return nomeColuna ? dados[nomeColuna] : '';
}

/**
 * Converte o valor de uma celula ExcelJS em texto limpo.
 */
function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return String(valor).trim();
  if (Array.isArray(valor.richText)) {
    return valor.richText.map(item => item.text || '').join('').trim();
  }
  if (valor.text) return String(valor.text).trim();
  if (valor.result !== undefined) return textoCelula(valor.result);
  return String(valor).trim();
}

/**
 * Le o corpo multipart coletando uma ou mais planilhas, na ordem de envio.
 * A primeira planilha e tratada como a principal.
 *
 * @param {Object} req - Requisicao Express (stream multipart).
 * @returns {Promise.<{ arquivos: Object, campos: Object }>}
 */
function lerMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: limiteTamanhoArquivo() } });
    const campos = {};
    const arquivos = [];

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const filename = String(info.filename || '').toLowerCase();
      if (name !== 'planilhas') {
        file.resume();
        return;
      }
      if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
        file.resume();
        reject(criarHttpError(400, `O arquivo "${info.filename}" nao e .xlsx/.xls.`));
        return;
      }

      const indiceArquivo = arquivos.length;
      arquivos.push(null);
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(criarHttpError(400, `O arquivo "${info.filename}" excede o limite de ${megabytes(limiteTamanhoArquivo())} MB.`)));
      file.on('end', () => {
        arquivos[indiceArquivo] = { filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (arquivos.length < 2 || arquivos.some(arquivo => !arquivo)) {
        reject(criarHttpError(400, 'Envie a planilha principal e ao menos uma planilha para cruzamento.'));
        return;
      }
      resolve({ arquivos, campos });
    });

    req.pipe(busboy);
  });
}

/**
 * Carrega um buffer XLSX lendo TODAS as abas e combinando-as numa unica planilha:
 * cada aba e lida com seu proprio cabecalho (linha 1); as colunas viram a uniao
 * (por nome) de todas as abas e as linhas sao concatenadas.
 *
 * @param {Buffer} buffer - Conteudo do arquivo .xlsx.
 * @returns {Promise.<{ colunas: {nome: string, index: number}[], linhas: Object[], abas: number }>}
 */
async function carregarPlanilha(buffer, abasSelecionadas = null) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length === 0) {
    throw criarHttpError(400, 'A planilha nao possui abas.');
  }

  const colunasUniao = new Map(); // nome -> indice sintetico (so para chave de UI)
  const linhas = [];
  let abasComDados = 0;

  for (const worksheet of workbook.worksheets) {
    if (Array.isArray(abasSelecionadas) && !abasSelecionadas.includes(worksheet.name)) continue;
    const colunasAba = obterCabecalhos(worksheet);
    if (colunasAba.length === 0) continue; // aba sem cabecalho (resumo, em branco) e ignorada
    abasComDados += 1;
    colunasAba.forEach(coluna => {
      if (!colunasUniao.has(coluna.nome)) {
        colunasUniao.set(coluna.nome, coluna.index);
      }
    });
    const linhasAba = lerLinhas(worksheet, colunasAba);
    linhasAba.forEach(linha => { linha.__abaOrigem = worksheet.name; });
    linhas.push(...linhasAba);
  }

  if (colunasUniao.size === 0) {
    throw criarHttpError(400, 'Nenhuma aba possui cabecalhos na primeira linha.');
  }

  const colunas = Array.from(colunasUniao.entries()).map(([nome, index]) => ({ nome, index }));
  return { colunas, linhas, abas: abasComDados };
}

/**
 * Le os cabecalhos (linha 1) retornando nome + indice de cada coluna preenchida.
 */
function obterCabecalhos(worksheet) {
  const headerRow = worksheet.getRow(1);
  const colunas = [];
  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    const nome = textoCelula(headerRow.getCell(col).value);
    if (nome) {
      colunas.push({ nome, index: col });
    }
  }
  return colunas;
}

/**
 * Converte a planilha em uma lista de objetos { coluna: valorTexto }.
 */
function lerLinhas(worksheet, colunas) {
  const linhas = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const dados = {};
    let preenchida = false;
    colunas.forEach(coluna => {
      const valor = textoCelula(row.getCell(coluna.index).value);
      dados[coluna.nome] = valor;
      dados.__colunasPorIndice = dados.__colunasPorIndice || {};
      dados.__colunasPorIndice[coluna.index] = valor;
      if (valor) preenchida = true;
    });
    if (preenchida) {
      dados.__linhaOrigem = rowIndex;
      linhas.push(dados);
    }
  }
  return linhas;
}

/**
 * Monta as primeiras amostras de valores por coluna (para conferencia na UI).
 */
function montarAmostras(linhas, colunas) {
  return linhas.slice(0, LIMITE_AMOSTRAS).map((dados, indice) => ({
    row_index: indice + 2,
    dados: Object.fromEntries(colunas.map(coluna => [coluna.nome, dados[coluna.nome] || '']))
  }));
}

/**
 * Lista os valores distintos de cada coluna (limitado), usado para montar o mapa de Tipo.
 */
function montarValoresDistintos(linhas, colunas) {
  const distintos = {};
  colunas.forEach(coluna => {
    const set = new Set();
    for (const dados of linhas) {
      const valor = (dados[coluna.nome] || '').trim();
      if (valor) set.add(valor);
      if (set.size >= LIMITE_VALORES_DISTINTOS) break;
    }
    distintos[coluna.nome] = Array.from(set);
  });
  return distintos;
}

/**
 * Sugere o mapeamento de uma planilha procurando nomes de coluna por termos.
 */
function acharColuna(colunas, ...termos) {
  const termosNorm = termos.map(normalizarTexto);
  for (const coluna of colunas) {
    const nomeNorm = normalizarTexto(coluna.nome);
    if (termosNorm.some(termo => nomeNorm === termo || nomeNorm.includes(termo))) {
      return coluna.nome;
    }
  }
  return '';
}

/**
 * Monta as sugestoes de mapeamento para os tres papeis de planilha.
 */
function sugerirMapeamentoPrincipal(colunas) {
  return {
    cnpj: acharColuna(colunas, 'cnpj', 'cpf/cnpj', 'cnpj/cpf'),
    razaoSocial: acharColuna(colunas, 'razao social', 'razão social', 'razao', 'empresa', 'cliente'),
    operadora: acharColuna(colunas, 'operadora'),
    data: acharColuna(colunas, 'data da venda', 'data'),
    valor: detectarColunaValor(colunas.map(coluna => coluna.nome))
  };
}

/** Retorna metadados de cada aba sem misturar suas linhas. */
async function listarAbas(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map(worksheet => {
    const colunas = obterCabecalhos(worksheet);
    const linhas = colunas.length ? lerLinhas(worksheet, colunas) : [];
    return {
      nome: worksheet.name,
      colunas,
      total_linhas: linhas.length,
      amostras: montarAmostras(linhas, colunas),
      valoresDistintos: montarValoresDistintos(linhas, colunas)
    };
  });
}

function sugerirMapeamentoOperadora(colunas) {
  return {
    cnpj: acharColuna(colunas, 'cnpj', 'cpf/cnpj', 'cnpj/cpf'),
    cpf: acharColuna(colunas, 'cpf'),
    razaoSocial: acharColuna(colunas, 'razao social', 'razão social', 'razao', 'empresa', 'cliente'),
    tipo: acharColuna(colunas, 'base/fresh', 'base', 'tipo')
  };
}

/**
 * Monta o pacote de preview (colunas, amostras, valores distintos) de uma planilha ja combinada.
 */
function previewPlanilha({ colunas, linhas, abas }) {
  return {
    colunas,
    abas,
    total_linhas: linhas.length,
    amostras: montarAmostras(linhas, colunas),
    valoresDistintos: montarValoresDistintos(linhas, colunas)
  };
}

/**
 * Gera a pre-visualizacao das planilhas para configuracao do mapeamento.
 *
 * @param {Object} req - Requisicao multipart com as planilhas em ordem.
 * @returns {Promise.<Object>} Preview da principal e das planilhas secundarias.
 */
async function previewCruzamento(req) {
  const { arquivos } = await lerMultipart(req);

  const planilhas = await Promise.all(arquivos.map(async arquivo => {
    const planilha = await carregarPlanilha(arquivo.buffer);
    return { ...previewPlanilha(planilha), arquivo: arquivo.filename };
  }));

  return {
    principal: planilhas[0],
    operadoras: planilhas.slice(1),
    sugestoes: {
      principal: sugerirMapeamentoPrincipal(planilhas[0].colunas),
      operadoras: planilhas.slice(1).map(planilha => sugerirMapeamentoOperadora(planilha.colunas))
    },
    abasPorArquivo: await Promise.all(arquivos.map(async (arquivo, arquivoIndex) => ({
      arquivoIndex,
      arquivo: arquivo.filename,
      abas: await listarAbas(arquivo.buffer)
    })))
  };
}

/**
 * Valida que uma coluna informada existe nos cabecalhos da planilha.
 */
function exigirColuna(colunas, nomeColuna, descricao) {
  if (!nomeColuna) {
    throw criarHttpError(400, `Selecione a coluna de ${descricao}.`);
  }
  const existe = colunas.some(coluna => coluna.nome === nomeColuna);
  if (!existe) {
    throw criarHttpError(400, `A coluna "${nomeColuna}" (${descricao}) nao existe na planilha.`);
  }
}

function validarColunaOpcional(colunas, nomeColuna, descricao) {
  if (nomeColuna) exigirColuna(colunas, nomeColuna, descricao);
}

function validarIndiceOpcional(colunas, indice, descricao) {
  if (indice === undefined || indice === null || indice === '') return;
  const numero = Number(indice);
  if (!Number.isInteger(numero) || !colunas.some(coluna => coluna.index === numero)) {
    throw criarHttpError(400, `A coluna informada por posicao (${descricao}) nao existe na planilha.`);
  }
}

function campoPreenchido(mapeamento, campo) {
  return Boolean(mapeamento?.[campo] || mapeamento?.[`${campo}Index`]);
}

function normalizarMapeamento(mapeamento = {}, campos = []) {
  return campos.reduce((acc, campo) => {
    acc[campo] = mapeamento[campo] || '';
    const indice = Number(mapeamento[`${campo}Index`]);
    if (Number.isInteger(indice) && indice > 0) {
      acc[`${campo}Index`] = indice;
    }
    return acc;
  }, {});
}

function mapeamentosPorAba(mapeamento) {
  return mapeamento && typeof mapeamento.abas === 'object' && mapeamento.abas !== null ? mapeamento.abas : {};
}

function algumMapeamento(mapeamento, predicado) {
  return predicado(mapeamento || {}) || Object.values(mapeamentosPorAba(mapeamento)).some(predicado);
}

function mapeamentoDaLinha(mapeamento, dados) {
  const aba = dados?.__abaOrigem || '';
  return { ...(mapeamento || {}), ...(mapeamentosPorAba(mapeamento)[aba] || {}) };
}

function normalizarMapeamentosAbas(abas) {
  return Object.fromEntries(Object.entries(abas || {}).map(([aba, mapeamento]) => [
    aba,
    {
      ...mapeamento,
      ...normalizarMapeamento(mapeamento, ['cnpj', 'cpf', 'razaoSocial', 'operadora', 'data', 'tipo', 'valor']),
      valorOperadora: normalizarTexto(mapeamento.valorOperadora)
    }
  ]));
}

function operadoraCombina(textoOperadora, operadora) {
  if (operadora.valorOperadora && textoOperadora.includes(operadora.valorOperadora)) return true;
  return Object.values(mapeamentosPorAba(operadora)).some(mapeamento => (
    mapeamento.valorOperadora && textoOperadora.includes(normalizarTexto(mapeamento.valorOperadora))
  ));
}

/**
 * Faz o parse e valida a config de mapeamento recebida no corpo multipart.
 */
function parseConfig(valor, colunasPorPlanilha) {
  let config;
  try {
    config = typeof valor === 'string' ? JSON.parse(valor) : valor;
  } catch (error) {
    throw criarHttpError(400, 'Configuracao de mapeamento invalida (JSON).');
  }

  if (!config || typeof config !== 'object') {
    throw criarHttpError(400, 'Configuracao de mapeamento ausente.');
  }

  const principal = config.principal || {};
  const operadoras = Array.isArray(config.operadoras) ? config.operadoras : [];
  const colunasPrincipal = colunasPorPlanilha[0];

  if (!algumMapeamento(principal, item => campoPreenchido(item, 'cnpj'))) {
    throw criarHttpError(400, 'Selecione a coluna de CPF/CNPJ da planilha principal.');
  }
  if (!algumMapeamento(principal, item => campoPreenchido(item, 'operadora'))) {
    throw criarHttpError(400, 'Selecione a coluna de operadora da planilha principal.');
  }
  validarColunaOpcional(colunasPrincipal, principal.cnpj, 'CPF/CNPJ da planilha principal');
  validarColunaOpcional(colunasPrincipal, principal.razaoSocial, 'Razao Social da planilha principal');
  validarColunaOpcional(colunasPrincipal, principal.operadora, 'operadora da planilha principal');
  validarColunaOpcional(colunasPrincipal, principal.data, 'data da planilha principal');
  validarColunaOpcional(colunasPrincipal, principal.valor, 'valor da planilha principal');
  validarIndiceOpcional(colunasPrincipal, principal.cnpjIndex, 'CPF/CNPJ da planilha principal');
  validarIndiceOpcional(colunasPrincipal, principal.razaoSocialIndex, 'Razao Social da planilha principal');
  validarIndiceOpcional(colunasPrincipal, principal.operadoraIndex, 'operadora da planilha principal');
  validarIndiceOpcional(colunasPrincipal, principal.dataIndex, 'data da planilha principal');
  Object.entries(mapeamentosPorAba(principal)).forEach(([aba, mapeamento]) => {
    validarColunaOpcional(colunasPrincipal, mapeamento.cnpj, `CPF/CNPJ da aba ${aba}`);
    validarColunaOpcional(colunasPrincipal, mapeamento.razaoSocial, `Razao Social da aba ${aba}`);
    validarColunaOpcional(colunasPrincipal, mapeamento.operadora, `operadora da aba ${aba}`);
    validarColunaOpcional(colunasPrincipal, mapeamento.data, `data da aba ${aba}`);
    validarColunaOpcional(colunasPrincipal, mapeamento.valor, `valor da aba ${aba}`);
    validarIndiceOpcional(colunasPrincipal, mapeamento.cnpjIndex, `CPF/CNPJ da aba ${aba}`);
    validarIndiceOpcional(colunasPrincipal, mapeamento.razaoSocialIndex, `Razao Social da aba ${aba}`);
    validarIndiceOpcional(colunasPrincipal, mapeamento.operadoraIndex, `operadora da aba ${aba}`);
    validarIndiceOpcional(colunasPrincipal, mapeamento.dataIndex, `data da aba ${aba}`);
  });
  if (operadoras.length !== colunasPorPlanilha.length - 1) {
    throw criarHttpError(400, 'A configuracao das planilhas enviadas esta incompleta.');
  }
  operadoras.forEach((operadora, index) => {
    const numero = index + 2;
    const colunasOperadora = colunasPorPlanilha[numero - 1];
    if (!algumMapeamento(operadora, item => campoPreenchido(item, 'cnpj') || campoPreenchido(item, 'cpf'))) {
      throw criarHttpError(400, `Selecione a coluna de CPF ou CNPJ da planilha ${numero}.`);
    }
    if (!algumMapeamento(operadora, item => campoPreenchido(item, 'tipo'))) {
      throw criarHttpError(400, `Selecione a coluna de Tipo da planilha ${numero}.`);
    }
    validarColunaOpcional(colunasOperadora, operadora.cnpj, `CNPJ da planilha ${numero}`);
    validarColunaOpcional(colunasOperadora, operadora.cpf, `CPF da planilha ${numero}`);
    validarColunaOpcional(colunasOperadora, operadora.razaoSocial, `Razao Social da planilha ${numero}`);
    validarColunaOpcional(colunasOperadora, operadora.tipo, `Tipo da planilha ${numero}`);
    validarIndiceOpcional(colunasOperadora, operadora.cnpjIndex, `CNPJ da planilha ${numero}`);
    validarIndiceOpcional(colunasOperadora, operadora.cpfIndex, `CPF da planilha ${numero}`);
    validarIndiceOpcional(colunasOperadora, operadora.razaoSocialIndex, `Razao Social da planilha ${numero}`);
    validarIndiceOpcional(colunasOperadora, operadora.tipoIndex, `Tipo da planilha ${numero}`);
    Object.entries(mapeamentosPorAba(operadora)).forEach(([aba, mapeamento]) => {
      validarColunaOpcional(colunasOperadora, mapeamento.cnpj, `CNPJ da aba ${aba}`);
      validarColunaOpcional(colunasOperadora, mapeamento.cpf, `CPF da aba ${aba}`);
      validarColunaOpcional(colunasOperadora, mapeamento.razaoSocial, `Razao Social da aba ${aba}`);
      validarColunaOpcional(colunasOperadora, mapeamento.tipo, `Tipo da aba ${aba}`);
      validarIndiceOpcional(colunasOperadora, mapeamento.cnpjIndex, `CNPJ da aba ${aba}`);
      validarIndiceOpcional(colunasOperadora, mapeamento.cpfIndex, `CPF da aba ${aba}`);
      validarIndiceOpcional(colunasOperadora, mapeamento.razaoSocialIndex, `Razao Social da aba ${aba}`);
      validarIndiceOpcional(colunasOperadora, mapeamento.tipoIndex, `Tipo da aba ${aba}`);
    });
    if (!algumMapeamento(operadora, item => Boolean(String(item.valorOperadora || '').trim()))) {
      throw criarHttpError(400, `Informe o identificador da planilha ${numero} na principal.`);
    }
  });

  const colunasResultado = Array.isArray(principal.colunasResultado) && principal.colunasResultado.length > 0
    ? principal.colunasResultado.filter(nome => colunasPorPlanilha[0].some(coluna => coluna.nome === nome))
    : colunasPorPlanilha[0].map(coluna => coluna.nome);

  if (colunasResultado.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma coluna para o resultado.');
  }

  const colunasOperadoraNomes = numero => (colunasPorPlanilha[numero] || []).map(coluna => coluna.nome);

  return {
    principal: {
      cnpj: principal.cnpj,
      razaoSocial: principal.razaoSocial,
      operadora: principal.operadora,
      data: principal.data || '',
      quantidade: principal.quantidade || '',
      valor: principal.valor || '',
      ...normalizarMapeamento(principal, ['cnpj', 'razaoSocial', 'operadora', 'data', 'quantidade', 'valor']),
      abas: mapeamentosPorAba(principal),
      colunasResultado
    },
    operadoras: operadoras.map((operadora, index) => ({
      cnpj: operadora.cnpj || '',
      cpf: operadora.cpf || '',
      razaoSocial: operadora.razaoSocial,
      tipo: operadora.tipo,
      ...normalizarMapeamento(operadora, ['cnpj', 'cpf', 'razaoSocial', 'tipo']),
      valorOperadora: normalizarTexto(operadora.valorOperadora),
      tipoMap: operadora.tipoMap || {},
      // Colunas de contas a somar como chips (ex.: Claro Ctns ...). Vazio = 1 chip por linha (ex.: Vivo).
      quantidadeColunas: Array.isArray(operadora.quantidadeColunas)
        ? operadora.quantidadeColunas.filter(nome => colunasOperadoraNomes(index + 1).includes(nome))
        : [],
      // Colunas de valor a somar como total pago na linha (ex.: Claro Receita ...; Vivo VALOR).
      // Vazio = detectar pelo nome; sem deteccao, o pareamento nao compara valores.
      valorColunas: Array.isArray(operadora.valorColunas)
        ? operadora.valorColunas.filter(nome => colunasOperadoraNomes(index + 1).includes(nome))
        : [],
      abas: normalizarMapeamentosAbas(mapeamentosPorAba(operadora))
    }))
  };
}

/**
 * Aplica o mapa de Tipo a um valor de origem (valor desconhecido passa cru).
 */
function aplicarTipoMap(tipoMap, valorOrigem) {
  const valor = (valorOrigem || '').trim();
  if (!valor) return '';
  // Uma coluna numerica selecionada por engano (ex.: "39") nao pode virar Tipo.
  // Mantemos o registro para auditoria, mas ele exigira validacao manual no resultado.
  if (/^\d+(?:[.,]\d+)?$/.test(valor)) return 'UNKNOWN';
  const chave = Object.keys(tipoMap).find(item => normalizarTexto(item) === normalizarTexto(valor));
  return chave ? tipoMap[chave] : valor;
}

// Paleta do arquivo final (ARGB do ExcelJS).
const CORES = {
  cabecalhoMes: 'FF305496', // azul escuro
  cabecalhoNaoConcluidas: 'FFC0504D', // vermelho escuro
  cabecalhoCanceladas: 'FF808080', // cinza
  fonteCabecalho: 'FFFFFFFF',
  linhaRevisao: 'FFFFF2CC', // amarelo: linha inteira quando precisa de revisao
  linhaCancelada: 'FFEDEDED', // cinza claro
  zebra: 'FFF2F2F2',
  borda: 'FFD9D9D9',
  fontePago: 'FF2E7D32', // verde
  fonteRevisao: 'FFB45309', // ambar
  fonteNaoEncontrado: 'FFC0392B' // vermelho
};

const STATUS_REVISAO = new Set(['PAGO_VALOR_DIVERGENTE', 'VALIDAR_MANUALMENTE']);
const COLUNAS_MONETARIAS = new Set(['Valor_Chip', 'Valor_Confirmacao']);

const fill = cor => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: cor } });
const bordaFina = { style: 'thin', color: { argb: CORES.borda } };

/**
 * Cor da fonte da celula de Status_Conciliacao, para leitura rapida do status.
 */
function corFonteStatus(status) {
  if (status === 'PAGO') return CORES.fontePago;
  if (STATUS_REVISAO.has(status)) return CORES.fonteRevisao;
  if (status === 'NAO_ENCONTRADO') return CORES.fonteNaoEncontrado;
  return '';
}

/**
 * Escreve uma aba com cabecalho, linhas, autoFilter e cabecalho congelado, aplicando o
 * visual do arquivo final: cabecalho colorido, zebra, bordas e destaque de revisao.
 *
 * @param {Object} [opcoes]
 * @param {string} [opcoes.corCabecalho] - Cor de fundo do cabecalho (default: azul dos meses).
 * @param {string} [opcoes.corLinha] - Cor fixa para todas as linhas (ex.: canceladas em cinza).
 * @param {number} [opcoes.colunaDivisao] - Coluna (1-based) que abre o bloco de colunas
 *   automaticas; recebe borda media a esquerda como divisoria.
 */
function escreverAba(workbook, titulo, cabecalho, linhas, opcoes = {}) {
  const worksheet = workbook.addWorksheet(titulo, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = cabecalho.map(nome => ({
    header: nome,
    key: nome,
    width: Math.min(Math.max(nome.length + 4, 12), 40),
    ...(COLUNAS_MONETARIAS.has(nome) ? { style: { numFmt: '#,##0.00' } } : {})
  }));

  const colunaStatus = cabecalho.indexOf('Status_Conciliacao') + 1;
  const colunaDivisao = opcoes.colunaDivisao || 0;

  const estilizar = (row, corFundo) => {
    for (let col = 1; col <= cabecalho.length; col += 1) {
      const cell = row.getCell(col);
      if (corFundo) cell.fill = fill(corFundo);
      cell.border = {
        top: bordaFina,
        bottom: bordaFina,
        left: col === colunaDivisao ? { style: 'medium', color: { argb: CORES.borda } } : bordaFina,
        right: bordaFina
      };
    }
  };

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: CORES.fonteCabecalho } };
  headerRow.alignment = { vertical: 'middle' };
  estilizar(headerRow, opcoes.corCabecalho || CORES.cabecalhoMes);

  linhas.forEach(linha => {
    const row = worksheet.addRow(linha);
    const revisao = STATUS_REVISAO.has(linha.Status_Conciliacao);
    // Destaque de revisao vence a cor fixa e a zebra; zebra so nas linhas pares.
    const corFundo = revisao
      ? CORES.linhaRevisao
      : opcoes.corLinha || (row.number % 2 === 0 ? '' : CORES.zebra);
    estilizar(row, corFundo);
    if (colunaStatus > 0) {
      const corFonte = corFonteStatus(linha.Status_Conciliacao);
      if (corFonte) row.getCell(colunaStatus).font = { bold: true, color: { argb: corFonte } };
    }
  });

  if (cabecalho.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: cabecalho.length }
    };
  }

  return worksheet;
}

const COLUNAS_AUTOMATICAS = ['Tipo', 'Tipo_Documento', 'Valor_Chip', 'Valor_Confirmacao', 'Status_Conciliacao', 'Arquivo_Confirmacao', 'Aba_Confirmacao', 'Linha_Confirmacao', 'Razao_Social_Confirmacao', 'Observacao_Automatica'];

/**
 * Sanitiza um nome para uso como aba do Excel: troca caracteres proibidos por espaco,
 * trunca em 31 caracteres e garante unicidade dentro do conjunto ja usado.
 */
function nomeAbaValido(nome, usados) {
  const limpo = String(nome || '').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sem mes';
  let candidato = limpo;
  let sufixo = 2;
  while (usados.has(candidato)) {
    candidato = `${limpo.slice(0, 31 - String(sufixo).length - 1)} ${sufixo}`;
    sufixo += 1;
  }
  usados.add(candidato);
  return candidato;
}

/**
 * Agrupa as linhas concluidas por mes (__mes) e devolve os grupos em ordem cronologica,
 * seguindo a organizacao por mes das planilhas das operadoras.
 */
function agruparPorMes(linhas) {
  const grupos = new Map();
  for (const linha of linhas) {
    const mes = linha.__mes || 'Sem mes';
    if (!grupos.has(mes)) grupos.set(mes, []);
    grupos.get(mes).push(linha);
  }
  return new Map([...grupos.entries()].sort((a, b) => chaveOrdenacaoMes(a[0]) - chaveOrdenacaoMes(b[0])));
}

/**
 * Escreve a aba "Resumo" (primeira do arquivo): totais por status com legenda de cores
 * e a quantidade de vendas pagas por mes.
 */
function escreverResumo(workbook, resultado) {
  const worksheet = workbook.addWorksheet('Resumo');
  worksheet.columns = [{ width: 30 }, { width: 60 }, { width: 12 }];

  const contagens = { PAGO: 0, PAGO_VALOR_DIVERGENTE: 0, VALIDAR_MANUALMENTE: 0, NAO_ENCONTRADO: 0 };
  for (const linha of [...resultado.concluidas, ...resultado.naoConcluidas]) {
    if (linha.Status_Conciliacao in contagens) contagens[linha.Status_Conciliacao] += 1;
  }

  const titulo = worksheet.addRow(['Cruzamento de Vendas']);
  titulo.font = { bold: true, size: 16 };
  const agora = new Date();
  worksheet.addRow([`Gerado em ${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`]).font = {
    color: { argb: 'FF808080' }
  };
  worksheet.addRow([]);

  const cabecalhoTabela = (linha) => {
    linha.font = { bold: true, color: { argb: CORES.fonteCabecalho } };
    linha.height = 20;
    [1, 2, 3].forEach(col => { linha.getCell(col).fill = fill(CORES.cabecalhoMes); });
  };

  cabecalhoTabela(worksheet.addRow(['Status', 'O que significa', 'Chips']));
  const legenda = [
    ['PAGO', 'Confirmado pela operadora (valor conferido quando mapeado).', contagens.PAGO, { fonte: CORES.fontePago }],
    ['PAGO_VALOR_DIVERGENTE', 'Pago, mas o valor não fecha com a operadora — revisar (linha amarela).', contagens.PAGO_VALOR_DIVERGENTE, { fundo: CORES.linhaRevisao, fonte: CORES.fonteRevisao }],
    ['VALIDAR_MANUALMENTE', 'Tipo da confirmação suspeito — revisar (linha amarela).', contagens.VALIDAR_MANUALMENTE, { fundo: CORES.linhaRevisao, fonte: CORES.fonteRevisao }],
    ['NAO_ENCONTRADO', 'Sem confirmação da operadora (aba "Vendas Nao Concluidas").', contagens.NAO_ENCONTRADO, { fonte: CORES.fonteNaoEncontrado }],
    ['CANCELADA', 'Cancelada na origem, fora do cruzamento (aba "Vendas Canceladas", linhas cinza).', resultado.canceladas?.length || 0, { fundo: CORES.linhaCancelada }]
  ];
  for (const [status, descricao, total, cores] of legenda) {
    const linha = worksheet.addRow([status, descricao, total]);
    if (cores.fundo) [1, 2, 3].forEach(col => { linha.getCell(col).fill = fill(cores.fundo); });
    linha.getCell(1).font = { bold: true, ...(cores.fonte ? { color: { argb: cores.fonte } } : {}) };
  }

  const pagosPorMes = agruparPorMes(resultado.concluidas);
  if (pagosPorMes.size > 0) {
    worksheet.addRow([]);
    cabecalhoTabela(worksheet.addRow(['Mês do fechamento', '', 'Chips']));
    for (const [mes, linhas] of pagosPorMes) {
      const linha = worksheet.addRow([mes, '', linhas.length]);
      linha.getCell(1).font = { bold: true };
    }
  }
}

/**
 * Gera o workbook final (.xlsx) preservando a formatacao por mes das planilhas que chegam:
 * aba "Resumo" com totais e legenda, vendas concluidas em uma aba por mes (na ordem da
 * principal) e uma unica aba com as nao concluidas, que ganha a coluna "Mes" no inicio
 * para nao perder a origem.
 */
async function gerarWorkbook(resultado, colunasResultado) {
  const workbook = new ExcelJS.Workbook();
  const cabecalho = [...colunasResultado, ...COLUNAS_AUTOMATICAS];
  const usados = new Set(['Resumo']);
  // Divisoria visual entre as colunas originais e o bloco automatico (comeca em "Tipo").
  const colunaDivisao = colunasResultado.length + 1;

  escreverResumo(workbook, resultado);

  for (const [mes, linhas] of agruparPorMes(resultado.concluidas)) {
    escreverAba(workbook, nomeAbaValido(mes, usados), cabecalho, linhas, { colunaDivisao });
  }

  const cabecalhoNaoConcluidas = ['Mês', ...cabecalho];
  const linhasNaoConcluidas = resultado.naoConcluidas.map(linha => ({ 'Mês': linha.__mes || '', ...linha }));
  escreverAba(workbook, nomeAbaValido('Vendas Nao Concluidas', usados), cabecalhoNaoConcluidas, linhasNaoConcluidas, {
    corCabecalho: CORES.cabecalhoNaoConcluidas,
    colunaDivisao: colunaDivisao + 1
  });

  // Lixeira: vendas canceladas na origem (STATUS), fora do cruzamento. So cria a aba se houver.
  if (resultado.canceladas?.length) {
    const cabecalhoCanceladas = ['Mês', ...colunasResultado, 'Status_Cancelamento'];
    const linhasCanceladas = resultado.canceladas.map(item => ({
      'Mês': item.mes || '',
      ...Object.fromEntries(colunasResultado.map(nome => [nome, item.dados[nome] || ''])),
      'Status_Cancelamento': item.status || ''
    }));
    escreverAba(workbook, nomeAbaValido('Vendas Canceladas', usados), cabecalhoCanceladas, linhasCanceladas, {
      corCabecalho: CORES.cabecalhoCanceladas,
      corLinha: CORES.linhaCancelada,
      colunaDivisao: cabecalhoCanceladas.length
    });
  }

  return workbook.xlsx.writeBuffer();
}

function indexarConfirmacao(linhas, mapeamento, arquivo) {
  const indice = {
    porDocumento: new Map(),
    porRazaoSocial: new Map()
  };

  const adicionar = (mapa, chave, registro) => {
    if (!chave) return;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(registro);
  };

  // Detecta os padroes da operadora uma vez (ex.: colunas "Ctns ..." e "Receita ..." da Claro).
  const colunasChipsAuto = detectarColunasChips(linhas.length ? Object.keys(linhas[0]) : []);
  const colunasValorAuto = detectarColunasValor(linhas.length ? Object.keys(linhas[0]) : []);

  for (const dados of linhas) {
    const mapaLinha = mapeamentoDaLinha(mapeamento, dados);
    const chaveRazao = normalizarChave(valorMapeado(dados, mapaLinha, 'razaoSocial'));
    const documento = documentoDaLinha(dados, mapaLinha);
    const registro = {
      tipo: aplicarTipoMap(mapaLinha.tipoMap || mapeamento.tipoMap, valorMapeado(dados, mapaLinha, 'tipo')),
      chips: quantidadeConfirmacao(dados, mapaLinha, colunasChipsAuto),
      // Valor total pago na linha (bundle): a Claro pode juntar chips de valores diferentes
      // numa linha so; null = sem coluna de valor (pareamento por contagem, como antes).
      valorTotal: valorConfirmacao(dados, mapaLinha, colunasValorAuto),
      dados,
      arquivo,
      tipoDocumento: documento.tipo,
      chaveDocumento: documento.chave,
      chaveRazao
    };
    adicionar(indice.porDocumento, documento.chave, registro);
    adicionar(indice.porRazaoSocial, chaveRazao, registro);
  }

  indice.has = chave => indice.porRazaoSocial.has(chave);
  indice.get = chave => indice.porRazaoSocial.get(chave)?.[0] || null;
  return indice;
}

/**
 * Lista TODAS as confirmacoes de uma empresa numa operadora (planilha de fechamento).
 * Cada confirmacao representa uma venda concluida; vendas divididas em varias linhas contam
 * todas. Prefere casar por documento (CPF/CNPJ) e cai para Razao Social quando nao ha documento.
 */
function listarConfirmacoes(indice, chaveDocumento, chaveRazao) {
  if (!indice) return [];
  if (indice instanceof Map) {
    const registro = chaveRazao ? indice.get(chaveRazao) : null;
    return registro ? [registro] : [];
  }
  if (chaveDocumento && indice.porDocumento?.has(chaveDocumento)) return indice.porDocumento.get(chaveDocumento);
  if (chaveRazao && indice.porRazaoSocial?.has(chaveRazao)) return indice.porRazaoSocial.get(chaveRazao);
  return [];
}

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Deriva o rotulo de mes no mesmo formato das abas das operadoras (ex.: "JANEIRO26",
 * "MARÇO26"): nome do mes em maiusculas + ano com 2 digitos, sem separador.
 * Aceita ISO (aaaa-mm-dd) e formato brasileiro (dd/mm/aaaa, com / - ou .).
 * Retorna '' quando nao consegue interpretar uma data valida.
 */
function mesDaData(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  let ano;
  let mes;
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
  } else {
    const br = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (br) {
      mes = Number(br[2]);
      ano = Number(br[3]);
      if (ano < 100) ano += 2000;
    }
  }
  if (!mes || mes < 1 || mes > 12) return '';
  return `${MESES_PT[mes - 1].toUpperCase()}${String(ano).slice(-2)}`;
}

/**
 * Chave de ordenacao cronologica para um rotulo de mes (ex.: "MARÇO26", "MAIO26 PF").
 * Reconhece o nome do mes e o ano (2 ou 4 digitos); um sufixo (ex.: " PF") ordena logo
 * apos o mes-base. Rotulos nao reconhecidos vao para o fim.
 */
function chaveOrdenacaoMes(rotulo) {
  const texto = normalizarTexto(rotulo);
  const indice = MESES_PT.findIndex(nome => texto.startsWith(normalizarTexto(nome)));
  if (indice === -1) return Number.MAX_SAFE_INTEGER;
  const anoMatch = texto.match(/(\d{2,4})/);
  const ano = anoMatch ? Number(anoMatch[1]) : 0;
  const anoNorm = ano < 100 ? 2000 + ano : ano;
  const semMesNemAno = texto.replace(normalizarTexto(MESES_PT[indice]), '').replace(/\d+/g, '').trim();
  return anoNorm * 100 + (indice + 1) * 2 + (semMesNemAno ? 1 : 0);
}

/**
 * Procura um subconjunto de exatamente `qtd` chips cuja soma de valores atinja `alvo`
 * (± tolerancia). Busca por combinacoes com poda: os grupos por cliente sao pequenos e a
 * quantidade por linha e baixa (1-3), entao o custo e trivial; ha um teto de iteracoes
 * como rede de seguranca.
 *
 * @returns {Object[]|null} Os chips escolhidos, ou null se nenhuma combinacao fecha.
 */
function encontrarSubconjuntoPorValor(chips, qtd, alvo, tolerancia) {
  if (qtd <= 0 || chips.length < qtd) return null;
  let iteracoes = 0;
  const escolhidos = [];
  const buscar = (inicio, restantes, soma) => {
    if (restantes === 0) return Math.abs(soma - alvo) <= tolerancia;
    for (let i = inicio; i <= chips.length - restantes; i += 1) {
      if ((iteracoes += 1) > LIMITE_ITERACOES_SUBCONJUNTO) return false;
      escolhidos.push(chips[i]);
      if (buscar(i + 1, restantes - 1, soma + chips[i].valor)) return true;
      escolhidos.pop();
    }
    return false;
  };
  return buscar(0, qtd, 0) ? [...escolhidos] : null;
}

/**
 * Pareia CHIP A CHIP as vendas da principal (ja explodidas em chips) com as confirmacoes das
 * operadoras. Como a operadora pode pagar os chips de uma mesma venda em meses diferentes,
 * o casamento e por chip individual, nao por venda inteira.
 *
 * Agrupa os chips por identidade (documento ou, na falta, Razao Social) + operadora. Cada linha
 * de confirmacao vira um "bundle" de N chips (Claro = soma das Ctns, podendo agregar chips de
 * valores diferentes numa linha; Vivo = 1 por linha) com o valor total pago. Em cada grupo:
 * - 1a fase (valor): cada bundle com valor procura exatamente N chips cuja soma de valores
 *   unitarios feche com o total pago (± tolerancia), preferindo chips do mes do bundle. Isso
 *   garante que o chip certo seja marcado como pago (ex.: operadora pagou o de 59,99, nao o
 *   de 49,99) e resolve linhas agregadas da Claro sem dividir valor por quantidade;
 * - 2a fase (contagem): bundles sem casamento por valor e chips restantes pareiam por slot,
 *   como antes (mes proprio -> ordem cronologica). Se ambos os lados tinham valor e nada
 *   fechou, o chip e sinalizado com divergencia de valor (pago, mas validar);
 * - chips sem par (alem do que a operadora faturou) ficam como nao concluidos.
 *
 * Cada chip recebe a confirmacao pareada, que define seu Tipo e o mes/aba de fechamento.
 *
 * @param {Object[]} chips - Chips da principal (com documento, operadora, mesPrincipal, valor).
 * @param {Object[]} indicesOperadoras - Indices de confirmacao por operadora (registros com .chips e .valorTotal).
 */
function parearChips(chips, indicesOperadoras) {
  const grupos = new Map();
  let avulsos = 0;
  for (const chip of chips) {
    const identidade = chip.documento?.chave || chip.chave;
    const grupoChave = identidade && chip.operadora >= 0 ? `${identidade}::${chip.operadora}` : `__sem::${avulsos++}`;
    if (!grupos.has(grupoChave)) grupos.set(grupoChave, []);
    grupos.get(grupoChave).push(chip);
  }

  for (const grupo of grupos.values()) {
    const base = grupo[0];
    const indiceOp = base.operadora >= 0 ? indicesOperadoras[base.operadora] : null;
    const confirmacoes = listarConfirmacoes(indiceOp, base.documento?.chave, base.chave);

    // Bundles: cada linha de confirmacao com sua quantidade de chips e o valor total pago.
    const bundles = confirmacoes
      .map(confirmacao => ({
        confirmacao,
        qtd: Number.isFinite(confirmacao.chips) ? confirmacao.chips : 1,
        valorTotal: confirmacao.valorTotal ?? null,
        mes: confirmacao.dados?.__abaOrigem || base.mesPrincipal || ''
      }))
      .filter(bundle => bundle.qtd > 0)
      .sort((a, b) => chaveOrdenacaoMes(a.mes) - chaveOrdenacaoMes(b.mes));

    // 1a fase: casamento por valor. So participam bundles com valor e chips com valor unitario.
    for (const bundle of bundles) {
      if (bundle.valorTotal === null) continue;
      const livres = grupo.filter(chip => !chip.confirmacao && chip.valor != null);
      const doMes = livres.filter(chip => chip.mesPrincipal === bundle.mes);
      const tolerancia = TOLERANCIA_VALOR * bundle.qtd;
      const subconjunto = encontrarSubconjuntoPorValor(doMes, bundle.qtd, bundle.valorTotal, tolerancia)
        || encontrarSubconjuntoPorValor(livres, bundle.qtd, bundle.valorTotal, tolerancia);
      if (!subconjunto) continue;
      for (const chip of subconjunto) {
        chip.confirmacao = bundle.confirmacao;
        chip.valorOk = true;
      }
      bundle.consumido = true;
    }

    // 2a fase: fallback por contagem com os bundles e chips restantes (comportamento original).
    const opPorMes = new Map(); // mes -> [confirmacao, ...] (1 slot por chip do bundle)
    for (const bundle of bundles) {
      if (bundle.consumido) continue;
      if (!opPorMes.has(bundle.mes)) opPorMes.set(bundle.mes, []);
      for (let i = 0; i < bundle.qtd; i += 1) opPorMes.get(bundle.mes).push(bundle.confirmacao);
    }
    const mesesCronologicos = [...opPorMes.keys()].sort((a, b) => chaveOrdenacaoMes(a) - chaveOrdenacaoMes(b));

    // Casa cada chip no seu proprio mes (data da venda); depois, qualquer mes em ordem cronologica.
    for (const chip of grupo) {
      if (chip.confirmacao) continue;
      const pool = opPorMes.get(chip.mesPrincipal);
      if (pool && pool.length) chip.confirmacao = pool.shift();
    }
    for (const chip of grupo) {
      if (chip.confirmacao) continue;
      for (const mes of mesesCronologicos) {
        const pool = opPorMes.get(mes);
        if (pool && pool.length) { chip.confirmacao = pool.shift(); break; }
      }
    }

    // Define o status final de cada chip.
    for (const chip of grupo) {
      const confirmacao = chip.confirmacao || null;
      chip.confirmacao = confirmacao;
      chip.concluida = Boolean(confirmacao);
      chip.tipo = confirmacao ? (confirmacao.tipo ?? '') : '';
      chip.mes = confirmacao ? (confirmacao.dados?.__abaOrigem || chip.mesPrincipal) : chip.mesPrincipal;
      // Divergencia: pareado por contagem quando ambos os lados tinham valor e nada fechou.
      if (confirmacao && chip.valorOk !== true && chip.valor != null && (confirmacao.valorTotal ?? null) !== null) {
        chip.valorOk = false;
      }
    }
  }
}

/**
 * Cruza a principal com qualquer quantidade de planilhas secundarias.
 */
function cruzarMultiplasPlanilhas(linhasPrincipal, indicesOperadoras, config) {
  const { principal, operadoras } = config;
  // Fallback de mes para a principal (usado nas nao concluidas e quando a confirmacao nao
  // tem aba de origem): se a principal vem em varias abas, usa o nome da aba; senao, a Data.
  const abasPrincipal = new Set(linhasPrincipal.map(dados => dados.__abaOrigem).filter(Boolean));
  const usarAbaComoMes = abasPrincipal.size > 1;
  // Coluna de quantidade da principal: detectada automaticamente quando nao foi mapeada.
  const colunaQtdAuto = campoPreenchido(principal, 'quantidade')
    ? ''
    : detectarColunaQuantidade(linhasPrincipal.length ? Object.keys(linhasPrincipal[0]) : []);
  // Coluna de quantidade efetiva (para zerar/normalizar no resultado, pois cada linha vira 1 chip).
  const colunaQtd = campoPreenchido(principal, 'quantidade') ? principal.quantidade : colunaQtdAuto;
  // Coluna de valor unitario (por chip) da principal: detectada quando nao mapeada.
  const colunaValorAuto = campoPreenchido(principal, 'valor')
    ? ''
    : detectarColunaValor(linhasPrincipal.length ? Object.keys(linhasPrincipal[0]) : []);
  const colunaValor = campoPreenchido(principal, 'valor') ? principal.valor : colunaValorAuto;
  // Coluna de status da principal: vendas canceladas saem do cruzamento (viram lixeira).
  const colunaStatus = detectarColunaStatus(linhasPrincipal.length ? Object.keys(linhasPrincipal[0]) : []);
  // Colunas estruturais mapeadas: ficam de fora da varredura de cancelamento em texto livre
  // (evita marcar razao social como "Cancelamentos Express Ltda").
  const colunasEstruturais = new Set(
    [principal.cnpj, principal.cpf, principal.razaoSocial, principal.operadora, principal.data, colunaQtd, colunaValor].filter(Boolean)
  );

  // Explode cada venda em chips individuais (1 chip por unidade da quantidade).
  const chips = [];
  const canceladas = [];
  for (const dados of linhasPrincipal) {
    const mapaPrincipal = mapeamentoDaLinha(principal, dados);
    const chave = normalizarChave(valorMapeado(dados, mapaPrincipal, 'razaoSocial'));
    const documento = documentoDaLinha(dados, mapaPrincipal);
    const textoOperadora = normalizarTexto(valorMapeado(dados, mapaPrincipal, 'operadora'));
    const operadora = operadoras.findIndex(op => operadoraCombina(textoOperadora, op));
    // Mes da principal (fallback): aba de origem quando multi-aba, senao a Data da venda.
    const mesPrincipal = usarAbaComoMes ? (dados.__abaOrigem || '') : mesDaData(valorMapeado(dados, mapaPrincipal, 'data'));
    // Vendas canceladas (STATUS ou comunicado em OBS) saem do cruzamento: nao entram no pareamento
    // nem sao explodidas em chips (1 linha = 1 venda cancelada).
    const motivo = motivoCancelamento(dados, colunaStatus, colunasEstruturais);
    if (motivo) {
      canceladas.push({ dados, mes: mesPrincipal, status: motivo });
      continue;
    }
    const qtd = quantidadePrincipal(dados, mapaPrincipal, colunaQtdAuto);
    // Valor unitario de cada chip (null quando nao interpretavel): usado na fase por valor.
    const valores = valoresChipsPrincipal(dados, mapaPrincipal, qtd, colunaValorAuto);
    for (let i = 0; i < qtd; i += 1) {
      chips.push({ dados, chave, documento, operadora, mesPrincipal, valor: valores[i] });
    }
  }

  parearChips(chips, indicesOperadoras);

  const rotuloTipoDocumento = tipo => tipo === 'cpf' ? 'CPF' : tipo === 'cnpj' ? 'CNPJ' : '';
  const formatarValor = valor => Number(valor).toFixed(2).replace('.', ',');

  const statusConciliacao = chip => {
    if (chip.tipo === 'UNKNOWN') return 'VALIDAR_MANUALMENTE';
    if (!chip.concluida) return 'NAO_ENCONTRADO';
    // Pareado por contagem com valores conhecidos dos dois lados que nao fecharam: validar.
    return chip.valorOk === false ? 'PAGO_VALOR_DIVERGENTE' : 'PAGO';
  };

  const observacaoAutomatica = chip => {
    if (chip.tipo === 'UNKNOWN') return 'Tipo da confirmação parece numérico ou inválido; validar o mapeamento da aba.';
    if (!chip.concluida) return 'Não encontrado na planilha de confirmação.';
    if (chip.valorOk === false) {
      return `Pago, mas valor divergente: chip de R$ ${formatarValor(chip.valor)}, linha de confirmação soma R$ ${formatarValor(chip.confirmacao?.valorTotal)}.`;
    }
    if (chip.valorOk === true) return 'Encontrado na planilha de confirmação (valor conferido).';
    return 'Encontrado na planilha de confirmação.';
  };

  // Cada linha do resultado representa UM chip.
  const montarLinha = chip => {
    const saida = Object.fromEntries(principal.colunasResultado.map(nome => [nome, chip.dados[nome] || '']));
    if (colunaQtd && Object.prototype.hasOwnProperty.call(saida, colunaQtd)) saida[colunaQtd] = 1;
    return Object.assign(saida, {
      // Chave reservada (fora do cabecalho): usada por gerarWorkbook para agrupar por mes.
      __mes: chip.mes || '',
      Tipo: chip.tipo || '',
      Tipo_Documento: rotuloTipoDocumento(chip.documento?.tipo),
      Valor_Chip: chip.valor != null ? chip.valor : '',
      Valor_Confirmacao: chip.confirmacao?.valorTotal != null ? chip.confirmacao.valorTotal : '',
      Status_Conciliacao: statusConciliacao(chip),
      Arquivo_Confirmacao: chip.confirmacao?.arquivo || '',
      Aba_Confirmacao: chip.confirmacao?.dados?.__abaOrigem || '',
      Linha_Confirmacao: chip.confirmacao?.dados?.__linhaOrigem || '',
      Razao_Social_Confirmacao: chip.confirmacao
        ? valorMapeado(
            chip.confirmacao.dados,
            mapeamentoDaLinha(operadoras[chip.operadora], chip.confirmacao.dados),
            'razaoSocial'
          ) || ''
        : '',
      Observacao_Automatica: observacaoAutomatica(chip)
    });
  };

  return {
    concluidas: chips.filter(chip => chip.concluida).map(montarLinha),
    naoConcluidas: chips.filter(chip => !chip.concluida).map(montarLinha),
    canceladas
  };
}

/**
 * Orquestra o cruzamento completo: le arquivos + config, cruza e devolve o .xlsx.
 *
 * @param {Object} req - Requisicao multipart com planilhas + campo config (JSON).
 * @returns {Promise.<Buffer>} Buffer do arquivo cruzamento.xlsx.
 */
async function processarCruzamento(req) {
  const { arquivos, campos } = await lerMultipart(req);

  let selecoesAbas = [];
  try { selecoesAbas = JSON.parse(campos.config || '{}').selecoesAbas || []; } catch (_) { /* parseConfig informa o erro */ }
  const planilhas = await Promise.all(arquivos.map((arquivo, arquivoIndex) => {
    const abas = selecoesAbas.filter(item => item.usar !== false && item.arquivoIndex === arquivoIndex).map(item => item.aba);
    if (selecoesAbas.length && abas.length === 0) {
      throw criarHttpError(400, `Selecione ao menos uma aba do arquivo "${arquivo.filename}".`);
    }
    return carregarPlanilha(arquivo.buffer, selecoesAbas.length ? abas : null);
  }));
  const config = parseConfig(campos.config, planilhas.map(planilha => planilha.colunas));
  const indicesOperadoras = planilhas.slice(1).map((planilha, index) => (
    indexarConfirmacao(planilha.linhas, config.operadoras[index], arquivos[index + 1].filename)
  ));
  const resultado = cruzarMultiplasPlanilhas(planilhas[0].linhas, indicesOperadoras, config);

  return gerarWorkbook(resultado, config.principal.colunasResultado);
}

module.exports = {
  previewCruzamento,
  processarCruzamento,
  // exportados para teste unitario do nucleo
  cruzarMultiplasPlanilhas,
  indexarConfirmacao,
  aplicarTipoMap,
  normalizarChave,
  classificarDocumento,
  documentoDaLinha,
  nomeAbaValido,
  mesDaData
};
