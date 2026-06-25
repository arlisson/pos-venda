const Busboy = require('busboy');
const ExcelJS = require('exceljs');

const LIMITE_VALORES_DISTINTOS = 50;
const LIMITE_AMOSTRAS = 5;

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
 * @param {*} valor - Valor cru da celula de documento.
 * @returns {{ tipo: ('cpf'|'cnpj'|null), digitos: string, chave: string }}
 */
function classificarDocumento(valor) {
  const digitos = normalizarDocumento(valor);
  if (digitos.length >= 14) {
    const cnpj = digitos.slice(-14);
    return { tipo: 'cnpj', digitos: cnpj, chave: `cnpj:${cnpj}` };
  }
  if (digitos.length === 11) {
    return { tipo: 'cpf', digitos, chave: `cpf:${digitos}` };
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
  const colunas = [mapeamento.cnpj, mapeamento.cpf].filter(Boolean);
  const candidatas = colunas.length
    ? colunas
    : [encontrarColunaPorTermos(dados, 'cnpj', 'cpf/cnpj', 'cnpj/cpf', 'cpf')].filter(Boolean);
  for (const coluna of candidatas) {
    const documento = classificarDocumento(dados[coluna]);
    if (documento.chave) return documento;
  }
  return { tipo: null, digitos: '', chave: '' };
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
    const busboy = Busboy({ headers: req.headers });
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
      file.on('limit', () => reject(criarHttpError(400, 'Arquivo excede o limite permitido.')));
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
        colunasUniao.set(coluna.nome, colunasUniao.size + 1);
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
    data: acharColuna(colunas, 'data da venda', 'data')
  };
}

/** Retorna metadados de cada aba sem misturar suas linhas. */
async function listarAbas(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map(worksheet => {
    const colunas = obterCabecalhos(worksheet);
    const linhas = colunas.length ? lerLinhas(worksheet, colunas) : [];
    return { nome: worksheet.name, colunas, total_linhas: linhas.length, amostras: montarAmostras(linhas, colunas) };
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

  exigirColuna(colunasPorPlanilha[0], principal.cnpj, 'CPF/CNPJ da planilha principal');
  if (principal.razaoSocial) {
    exigirColuna(colunasPorPlanilha[0], principal.razaoSocial, 'Razao Social da planilha principal');
  }
  exigirColuna(colunasPorPlanilha[0], principal.operadora, 'operadora da planilha principal');
  if (principal.data) {
    exigirColuna(colunasPorPlanilha[0], principal.data, 'data da planilha principal');
  }
  if (operadoras.length !== colunasPorPlanilha.length - 1) {
    throw criarHttpError(400, 'A configuracao das planilhas enviadas esta incompleta.');
  }
  operadoras.forEach((operadora, index) => {
    const numero = index + 2;
    if (!operadora.cnpj && !operadora.cpf) {
      throw criarHttpError(400, `Selecione a coluna de CPF ou CNPJ da planilha ${numero}.`);
    }
    if (operadora.cnpj) {
      exigirColuna(colunasPorPlanilha[numero - 1], operadora.cnpj, `CNPJ da planilha ${numero}`);
    }
    if (operadora.cpf) {
      exigirColuna(colunasPorPlanilha[numero - 1], operadora.cpf, `CPF da planilha ${numero}`);
    }
    if (operadora.razaoSocial) {
      exigirColuna(colunasPorPlanilha[numero - 1], operadora.razaoSocial, `Razao Social da planilha ${numero}`);
    }
    exigirColuna(colunasPorPlanilha[numero - 1], operadora.tipo, `Tipo da planilha ${numero}`);
    if (!String(operadora.valorOperadora || '').trim()) {
      throw criarHttpError(400, `Informe o identificador da planilha ${numero} na principal.`);
    }
  });

  const colunasResultado = Array.isArray(principal.colunasResultado) && principal.colunasResultado.length > 0
    ? principal.colunasResultado.filter(nome => colunasPorPlanilha[0].some(coluna => coluna.nome === nome))
    : colunasPorPlanilha[0].map(coluna => coluna.nome);

  if (colunasResultado.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma coluna para o resultado.');
  }

  return {
    principal: {
      cnpj: principal.cnpj,
      razaoSocial: principal.razaoSocial,
      operadora: principal.operadora,
      data: principal.data || '',
      colunasResultado
    },
    operadoras: operadoras.map(operadora => ({
      cnpj: operadora.cnpj || '',
      cpf: operadora.cpf || '',
      razaoSocial: operadora.razaoSocial,
      tipo: operadora.tipo,
      valorOperadora: normalizarTexto(operadora.valorOperadora),
      tipoMap: operadora.tipoMap || {}
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

/**
 * Indexa uma planilha de operadora em Map<razaoSocial, Tipo>. Ultima ocorrencia prevalece.
 */
function indexarOperadora(linhas, mapeamento) {
  const indice = new Map();
  for (const dados of linhas) {
    const chave = normalizarChave(dados[mapeamento.razaoSocial]);
    if (!chave) continue;
    indice.set(chave, aplicarTipoMap(mapeamento.tipoMap, dados[mapeamento.tipo]));
  }
  return indice;
}

/**
 * Cruza as linhas da principal contra as operadoras e separa concluidas/nao concluidas.
 *
 * Etapas: classificar (achar na operadora) -> deduplicar por razaoSocial+operadora -> separar.
 *
 * @returns {{ concluidas: Object[], naoConcluidas: Object[] }}
 */
function cruzar(linhasPrincipal, indiceClaro, indiceVivo, config) {
  const { principal, claro, vivo } = config;

  /**
   * Detecta a operadora (claro/vivo) a partir do texto da coluna operadora.
   */
  function detectarOperadora(textoOperadora) {
    const texto = normalizarTexto(textoOperadora);
    if (!texto) return null;
    if (claro.valorOperadora && texto.includes(claro.valorOperadora)) return 'claro';
    if (vivo.valorOperadora && texto.includes(vivo.valorOperadora)) return 'vivo';
    return null;
  }

  // Passo 3: classificar cada linha
  const classificadas = linhasPrincipal.map(dados => {
    const chave = normalizarChave(dados[principal.razaoSocial]);
    const operadora = detectarOperadora(dados[principal.operadora]);
    const indice = operadora === 'claro' ? indiceClaro : operadora === 'vivo' ? indiceVivo : null;

    let concluida = false;
    let tipo = '';
    if (chave && indice && indice.has(chave)) {
      concluida = true;
      tipo = indice.get(chave);
    }

    return { dados, chave, operadora, concluida, tipo };
  });

  // Passo 4: deduplicar por razaoSocial+operadora ("manter a concluida")
  const grupos = new Map();
  for (const linha of classificadas) {
    const grupoChave = `${linha.chave}::${linha.operadora || ''}`;
    if (!linha.chave) {
      // sem Razao Social nao agrupa: cada uma e unica
      grupos.set(`${grupoChave}::${grupos.size}`, [linha]);
      continue;
    }
    if (!grupos.has(grupoChave)) grupos.set(grupoChave, []);
    grupos.get(grupoChave).push(linha);
  }

  const selecionadas = [];
  for (const grupo of grupos.values()) {
    if (grupo.length === 1) {
      selecionadas.push(grupo[0]);
      continue;
    }
    const concluida = grupo.find(item => item.concluida);
    if (concluida) {
      selecionadas.push(concluida);
      continue;
    }
    // nenhuma concluida: manter a mais recente por data (fallback) ou a ultima
    const ordenadas = [...grupo].sort((a, b) => {
      const dataA = principal.data ? String(a.dados[principal.data] || '') : '';
      const dataB = principal.data ? String(b.dados[principal.data] || '') : '';
      return dataA.localeCompare(dataB);
    });
    selecionadas.push(ordenadas[ordenadas.length - 1]);
  }

  // Passo 5: montar saidas com colunasResultado + Tipo
  const montarLinha = linha => {
    const saida = {};
    principal.colunasResultado.forEach(nome => {
      saida[nome] = linha.dados[nome] || '';
    });
    saida.Tipo = linha.tipo || '';
    return saida;
  };

  return {
    concluidas: selecionadas.filter(item => item.concluida).map(montarLinha),
    naoConcluidas: selecionadas.filter(item => !item.concluida).map(montarLinha)
  };
}

/**
 * Escreve uma aba com cabecalho, linhas, autoFilter e cabecalho congelado.
 */
function escreverAba(workbook, titulo, cabecalho, linhas) {
  const worksheet = workbook.addWorksheet(titulo, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = cabecalho.map(nome => ({
    header: nome,
    key: nome,
    width: Math.min(Math.max(nome.length + 4, 12), 40)
  }));

  worksheet.getRow(1).font = { bold: true };

  linhas.forEach(linha => worksheet.addRow(linha));

  if (cabecalho.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: cabecalho.length }
    };
  }

  return worksheet;
}

/**
 * Gera o workbook final (.xlsx) com as duas abas do cruzamento.
 */
async function gerarWorkbook(resultado, colunasResultado) {
  const workbook = new ExcelJS.Workbook();
  const cabecalho = [...colunasResultado, 'Tipo', 'Tipo_Documento', 'Status_Conciliacao', 'Arquivo_Confirmacao', 'Aba_Confirmacao', 'Linha_Confirmacao', 'Razao_Social_Confirmacao', 'Observacao_Automatica'];
  escreverAba(workbook, 'Vendas Concluidas', cabecalho, resultado.concluidas);
  escreverAba(workbook, 'Vendas Nao Concluidas', cabecalho, resultado.naoConcluidas);
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

  for (const dados of linhas) {
    const chaveRazao = normalizarChave(dados[mapeamento.razaoSocial]);
    const documento = documentoDaLinha(dados, mapeamento);
    const registro = {
      tipo: aplicarTipoMap(mapeamento.tipoMap, dados[mapeamento.tipo]),
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

function buscarConfirmacao(indice, chaveDocumento, chaveRazao) {
  if (!indice) return null;
  if (indice instanceof Map) return chaveRazao ? indice.get(chaveRazao) : null;
  if (chaveDocumento && indice.porDocumento?.has(chaveDocumento)) return indice.porDocumento.get(chaveDocumento)[0];
  if (chaveRazao && indice.porRazaoSocial?.has(chaveRazao)) return indice.porRazaoSocial.get(chaveRazao)[0];
  return null;
}

/**
 * Cruza a principal com qualquer quantidade de planilhas secundarias.
 */
function cruzarMultiplasPlanilhas(linhasPrincipal, indicesOperadoras, config) {
  const { principal, operadoras } = config;
  const classificadas = linhasPrincipal.map(dados => {
    const chave = normalizarChave(dados[principal.razaoSocial]);
    const documento = documentoDaLinha(dados, principal);
    const textoOperadora = normalizarTexto(dados[principal.operadora]);
    const indice = operadoras.findIndex(operadora => textoOperadora.includes(operadora.valorOperadora));
    const confirmacao = indice >= 0 ? buscarConfirmacao(indicesOperadoras[indice], documento.chave, chave) : null;
    const encontrou = Boolean(confirmacao);
    const tipo = confirmacao?.tipo || confirmacao || '';
    return { dados, chave, documento, operadora: indice, concluida: encontrou, tipo, confirmacao: typeof confirmacao === 'object' ? confirmacao : null };
  });

  const rotuloTipoDocumento = tipo => tipo === 'cpf' ? 'CPF' : tipo === 'cnpj' ? 'CNPJ' : '';

  const montarLinha = linha => Object.assign(
    Object.fromEntries(principal.colunasResultado.map(nome => [nome, linha.dados[nome] || ''])),
    {
      Tipo: linha.tipo || '',
      Tipo_Documento: rotuloTipoDocumento(linha.documento?.tipo),
      Status_Conciliacao: linha.tipo === 'UNKNOWN' ? 'VALIDAR_MANUALMENTE' : (linha.concluida ? 'PAGO' : 'NAO_ENCONTRADO'),
      Arquivo_Confirmacao: linha.confirmacao?.arquivo || '',
      Aba_Confirmacao: linha.confirmacao?.dados?.__abaOrigem || '',
      Linha_Confirmacao: linha.confirmacao?.dados?.__linhaOrigem || '',
      Razao_Social_Confirmacao: linha.confirmacao?.dados?.[operadoras[linha.operadora]?.razaoSocial] || '',
      Observacao_Automatica: linha.tipo === 'UNKNOWN'
        ? 'Tipo da confirmação parece numérico ou inválido; validar o mapeamento da aba.'
        : (linha.concluida ? 'Encontrado na planilha de confirmação.' : 'Não encontrado na planilha de confirmação.')
    }
  );
  return {
    concluidas: classificadas.filter(item => item.concluida).map(montarLinha),
    naoConcluidas: classificadas.filter(item => !item.concluida).map(montarLinha)
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
  cruzar,
  cruzarMultiplasPlanilhas,
  indexarOperadora,
  indexarConfirmacao,
  aplicarTipoMap,
  normalizarChave,
  classificarDocumento,
  documentoDaLinha
};
