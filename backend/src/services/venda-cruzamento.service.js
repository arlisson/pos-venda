const Busboy = require('busboy');
const ExcelJS = require('exceljs');

const CAMPOS_ARQUIVOS = ['principal', 'claro', 'vivo'];
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
 * Le o corpo multipart coletando os 3 arquivos esperados e os campos de texto.
 *
 * @param {Object} req - Requisicao Express (stream multipart).
 * @returns {Promise.<{ arquivos: Object, campos: Object }>}
 */
function lerMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const campos = {};
    const arquivos = {};
    const buffers = {};

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const filename = String(info.filename || '').toLowerCase();
      if (!CAMPOS_ARQUIVOS.includes(name)) {
        file.resume();
        return;
      }
      if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
        file.resume();
        reject(criarHttpError(400, `O arquivo "${info.filename}" nao e .xlsx/.xls.`));
        return;
      }

      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(criarHttpError(400, 'Arquivo excede o limite permitido.')));
      file.on('end', () => {
        buffers[name] = Buffer.concat(chunks);
        arquivos[name] = { filename: info.filename, mimeType: info.mimeType };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      const faltando = CAMPOS_ARQUIVOS.filter(campo => !buffers[campo]);
      if (faltando.length > 0) {
        reject(criarHttpError(400, `Envie as 3 planilhas. Faltando: ${faltando.join(', ')}.`));
        return;
      }

      resolve({
        arquivos: Object.fromEntries(
          CAMPOS_ARQUIVOS.map(campo => [campo, { ...arquivos[campo], buffer: buffers[campo] }])
        ),
        campos
      });
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
async function carregarPlanilha(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (workbook.worksheets.length === 0) {
    throw criarHttpError(400, 'A planilha nao possui abas.');
  }

  const colunasUniao = new Map(); // nome -> indice sintetico (so para chave de UI)
  const linhas = [];
  let abasComDados = 0;

  for (const worksheet of workbook.worksheets) {
    const colunasAba = obterCabecalhos(worksheet);
    if (colunasAba.length === 0) continue; // aba sem cabecalho (resumo, em branco) e ignorada
    abasComDados += 1;
    colunasAba.forEach(coluna => {
      if (!colunasUniao.has(coluna.nome)) {
        colunasUniao.set(coluna.nome, colunasUniao.size + 1);
      }
    });
    linhas.push(...lerLinhas(worksheet, colunasAba));
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
function sugerirMapeamento(colunasPorPapel) {
  return {
    principal: {
      razaoSocial: acharColuna(colunasPorPapel.principal, 'razao social', 'razão social', 'razao', 'empresa', 'cliente'),
      operadora: acharColuna(colunasPorPapel.principal, 'operadora'),
      data: acharColuna(colunasPorPapel.principal, 'data da venda', 'data')
    },
    claro: {
      razaoSocial: acharColuna(colunasPorPapel.claro, 'razao social', 'razão social', 'razao', 'empresa', 'cliente'),
      tipo: acharColuna(colunasPorPapel.claro, 'tipo')
    },
    vivo: {
      razaoSocial: acharColuna(colunasPorPapel.vivo, 'razao social', 'razão social', 'razao', 'empresa', 'cliente'),
      tipo: acharColuna(colunasPorPapel.vivo, 'base/fresh', 'base', 'tipo')
    }
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
 * Gera a pre-visualizacao das tres planilhas para configuracao do mapeamento.
 *
 * @param {Object} req - Requisicao multipart com os campos principal/claro/vivo.
 * @returns {Promise.<Object>} Preview por planilha + sugestoes de mapeamento.
 */
async function previewCruzamento(req) {
  const { arquivos } = await lerMultipart(req);

  const previews = {};
  const colunasPorPapel = {};
  for (const campo of CAMPOS_ARQUIVOS) {
    const planilha = await carregarPlanilha(arquivos[campo].buffer);
    previews[campo] = previewPlanilha(planilha);
    previews[campo].arquivo = arquivos[campo].filename;
    colunasPorPapel[campo] = planilha.colunas;
  }

  return {
    ...previews,
    sugestoes: sugerirMapeamento(colunasPorPapel)
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
function parseConfig(valor, colunasPorPapel) {
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
  const claro = config.claro || {};
  const vivo = config.vivo || {};

  exigirColuna(colunasPorPapel.principal, principal.razaoSocial, 'Razao Social da planilha principal');
  exigirColuna(colunasPorPapel.principal, principal.operadora, 'operadora da planilha principal');
  if (principal.data) {
    exigirColuna(colunasPorPapel.principal, principal.data, 'data da planilha principal');
  }
  exigirColuna(colunasPorPapel.claro, claro.razaoSocial, 'Razao Social da planilha Claro');
  exigirColuna(colunasPorPapel.claro, claro.tipo, 'Tipo da planilha Claro');
  exigirColuna(colunasPorPapel.vivo, vivo.razaoSocial, 'Razao Social da planilha Vivo');
  exigirColuna(colunasPorPapel.vivo, vivo.tipo, 'Tipo da planilha Vivo');

  const colunasResultado = Array.isArray(principal.colunasResultado) && principal.colunasResultado.length > 0
    ? principal.colunasResultado.filter(nome => colunasPorPapel.principal.some(coluna => coluna.nome === nome))
    : colunasPorPapel.principal.map(coluna => coluna.nome);

  if (colunasResultado.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma coluna para o resultado.');
  }

  return {
    principal: {
      razaoSocial: principal.razaoSocial,
      operadora: principal.operadora,
      data: principal.data || '',
      colunasResultado
    },
    claro: {
      razaoSocial: claro.razaoSocial,
      tipo: claro.tipo,
      valorOperadora: normalizarTexto(claro.valorOperadora || 'claro'),
      tipoMap: claro.tipoMap || {}
    },
    vivo: {
      razaoSocial: vivo.razaoSocial,
      tipo: vivo.tipo,
      valorOperadora: normalizarTexto(vivo.valorOperadora || 'vivo'),
      tipoMap: vivo.tipoMap || {}
    }
  };
}

/**
 * Aplica o mapa de Tipo a um valor de origem (valor desconhecido passa cru).
 */
function aplicarTipoMap(tipoMap, valorOrigem) {
  const valor = (valorOrigem || '').trim();
  if (!valor) return '';
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
  const cabecalho = [...colunasResultado, 'Tipo'];
  escreverAba(workbook, 'Vendas Concluidas', cabecalho, resultado.concluidas);
  escreverAba(workbook, 'Vendas Nao Concluidas', cabecalho, resultado.naoConcluidas);
  return workbook.xlsx.writeBuffer();
}

/**
 * Orquestra o cruzamento completo: le arquivos + config, cruza e devolve o .xlsx.
 *
 * @param {Object} req - Requisicao multipart com 3 arquivos + campo config (JSON).
 * @returns {Promise.<Buffer>} Buffer do arquivo cruzamento.xlsx.
 */
async function processarCruzamento(req) {
  const { arquivos, campos } = await lerMultipart(req);

  const colunasPorPapel = {};
  const linhasPorPapel = {};
  for (const campo of CAMPOS_ARQUIVOS) {
    const planilha = await carregarPlanilha(arquivos[campo].buffer);
    colunasPorPapel[campo] = planilha.colunas;
    linhasPorPapel[campo] = planilha.linhas;
  }

  const config = parseConfig(campos.config, colunasPorPapel);

  const indiceClaro = indexarOperadora(linhasPorPapel.claro, config.claro);
  const indiceVivo = indexarOperadora(linhasPorPapel.vivo, config.vivo);

  const resultado = cruzar(linhasPorPapel.principal, indiceClaro, indiceVivo, config);

  return gerarWorkbook(resultado, config.principal.colunasResultado);
}

module.exports = {
  previewCruzamento,
  processarCruzamento,
  // exportados para teste unitario do nucleo
  cruzar,
  indexarOperadora,
  aplicarTipoMap,
  normalizarChave
};
