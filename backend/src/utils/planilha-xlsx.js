const Busboy = require('busboy');
const ExcelJS = require('exceljs');

/**
 * Helpers reutilizaveis para leitura de planilhas XLSX enviadas via multipart.
 * Extraidos do padrao usado em services/cnpj-importacao.service.js para uso
 * compartilhado (ex.: importacao de vendas antigas).
 */

function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? '' : valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return String(valor).trim();
  if (Array.isArray(valor.richText)) return valor.richText.map(item => item.text || '').join('').trim();
  if (valor.text) return String(valor.text).trim();
  if (valor.result !== undefined) return textoCelula(valor.result);
  return String(valor).trim();
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Le um upload multipart em memoria, exigindo um arquivo .xlsx.
 * Resolve com { arquivo: { filename, mimeType, buffer }, campos }.
 */
function lerArquivoMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const campos = {};
    const chunks = [];
    let arquivo = null;

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      arquivo = {
        fieldname: name,
        filename: info.filename,
        mimeType: info.mimeType
      };

      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(criarHttpError(400, 'Arquivo excede o limite permitido.')));
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!arquivo || chunks.length === 0) {
        reject(criarHttpError(400, 'Envie uma planilha XLSX.'));
        return;
      }

      if (!String(arquivo.filename || '').toLowerCase().endsWith('.xlsx')) {
        reject(criarHttpError(400, 'Envie um arquivo .xlsx.'));
        return;
      }

      resolve({
        arquivo: {
          ...arquivo,
          buffer: Buffer.concat(chunks)
        },
        campos
      });
    });

    req.pipe(busboy);
  });
}

async function lerWorksheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw criarHttpError(400, 'A planilha nao possui abas.');
  return worksheet;
}

/**
 * Carrega o workbook inteiro (todas as abas). Lanca erro se nao houver abas.
 */
async function lerWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) throw criarHttpError(400, 'A planilha nao possui abas.');
  return workbook;
}

function obterCabecalhos(worksheet, linhaCabecalho = 1) {
  const header = worksheet.getRow(linhaCabecalho);
  const colunas = [];

  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    const nome = textoCelula(header.getCell(col).value);
    if (nome) colunas.push({ nome, index: col });
  }

  if (colunas.length === 0) {
    throw criarHttpError(400, `Nao foi possivel identificar cabecalhos na linha ${linhaCabecalho}.`);
  }

  return colunas;
}

function colunaCombinaPalavraChave(nome, palavrasChave) {
  const normalizado = normalizarTexto(nome);
  return palavrasChave.some(palavra => {
    const chave = normalizarTexto(palavra);
    if (!chave) return false;
    if (normalizado === chave) return true;
    // Evita aceitar avisos longos como cabecalho so porque citam "CNPJ" no texto.
    return normalizado.includes(chave) && normalizado.length <= 30;
  });
}

/**
 * Procura a linha de cabecalho nas primeiras linhas da aba.
 * Quando palavrasChave sao informadas, exige uma coluna compativel (ex.: CNPJ).
 */
function detectarCabecalhos(worksheet, opcoes = {}) {
  const maxLinhas = Math.min(Number(opcoes.maxLinhas) || 12, worksheet.rowCount || 0);
  const palavrasChave = Array.isArray(opcoes.palavrasChave) ? opcoes.palavrasChave : [];

  for (let linha = 1; linha <= maxLinhas; linha += 1) {
    let colunas;
    try {
      colunas = obterCabecalhos(worksheet, linha);
    } catch {
      continue;
    }

    if (palavrasChave.length === 0) {
      return { linhaCabecalho: linha, colunas };
    }

    const temColunaChave = colunas.some(coluna => colunaCombinaPalavraChave(coluna.nome, palavrasChave));
    if (temColunaChave && colunas.length >= 2) {
      return { linhaCabecalho: linha, colunas };
    }
  }

  throw criarHttpError(400, 'Nao foi possivel identificar cabecalhos validos na planilha.');
}

/**
 * Retorna a primeira aba cuja area inicial possui cabecalhos validos.
 */
function primeiraAbaComCabecalho(workbook, opcoes = {}) {
  for (const worksheet of workbook.worksheets) {
    try {
      const resultado = detectarCabecalhos(worksheet, opcoes);
      if (resultado.colunas.length) return { worksheet, ...resultado };
    } catch {
      // aba sem cabecalho valido: tenta a proxima
    }
  }
  throw criarHttpError(400, 'Nenhuma aba com cabecalhos foi encontrada na planilha.');
}

/**
 * Retorna algumas linhas de amostra para preview no frontend.
 */
function montarAmostras(worksheet, colunas, limiteLinhas = 5, linhaCabecalho = 1) {
  const amostras = [];
  const primeiraLinhaDados = linhaCabecalho + 1;
  const limite = Math.min(worksheet.rowCount, linhaCabecalho + limiteLinhas);

  for (let rowIndex = primeiraLinhaDados; rowIndex <= limite; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const dados = {};
    colunas.forEach(coluna => {
      dados[coluna.nome] = textoCelula(row.getCell(coluna.index).value);
    });
    amostras.push({ row_index: rowIndex, dados });
  }

  return amostras;
}

/**
 * Sugere a coluna cujo cabecalho contem alguma das palavras-chave informadas.
 */
function sugerirColuna(colunas, palavrasChave) {
  const chaves = (Array.isArray(palavrasChave) ? palavrasChave : [palavrasChave]).map(normalizarTexto);
  const encontrada = colunas.find(coluna => {
    const nome = normalizarTexto(coluna.nome);
    return chaves.some(chave => chave && nome.includes(chave));
  });
  return encontrada?.nome || '';
}

module.exports = {
  criarHttpError,
  textoCelula,
  normalizarTexto,
  lerArquivoMultipart,
  lerWorksheet,
  lerWorkbook,
  primeiraAbaComCabecalho,
  detectarCabecalhos,
  obterCabecalhos,
  montarAmostras,
  sugerirColuna
};
