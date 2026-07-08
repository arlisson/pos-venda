const Busboy = require('busboy');
const ExcelJS = require('exceljs');
const db = require('../database/connection');
const cnpjService = require('./cnpj.service');
const clienteSecretoService = require('./cliente-secreto.service');
const googlePlacesService = require('./google-places.service');
const ClienteSecreto = require('../models/ClienteSecreto');

const INTERVALO_CONSULTA_MS = Number(process.env.CNPJ_IMPORT_INTERVALO_MS || 21000);
const LIMITE_LINHAS = Number(process.env.CNPJ_IMPORT_LIMITE_LINHAS || 50);
const TABELA_BUSCAS_REALIZADAS = 'cnpj_buscas_realizadas';
const TABELA_BUSCAS_TEXTO_REALIZADAS = 'cnpj_buscas_texto_realizadas';
const COLUNAS_EXPORTACAO = [
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Mensagem', key: 'message', width: 32 },
  { header: 'CNPJ', key: 'cnpj', width: 20 },
  { header: 'Razao social', key: 'razao_social', width: 36 },
  { header: 'Nome fantasia', key: 'nome_fantasia', width: 28 },
  { header: 'Situacao', key: 'situacao_cadastral', width: 18 },
  { header: 'E-mail', key: 'email', width: 28 },
  { header: 'Telefone', key: 'telefone', width: 18 },
  { header: 'Tel. Open CNPJ', key: 'telefone_open_cnpj', width: 18 },
  { header: 'Tel. CNPJ.ws', key: 'telefone_cnpjws', width: 18 },
  { header: 'Tel. Minha Receita', key: 'telefone_minha_receita', width: 18 },
  { header: 'Tel. Google', key: 'telefone_google_places', width: 18 },
  { header: 'Google status', key: 'google_status', width: 18 },
  { header: 'Google detalhe', key: 'google_detalhe', width: 32 },
  { header: 'Avisos', key: 'avisos', width: 42 },
  { header: 'Fonte telefone', key: 'telefone_fonte', width: 18 },
  { header: 'Conf. telefone', key: 'telefone_confianca', width: 16 },
  { header: 'CEP', key: 'cep', width: 14 },
  { header: 'Endereco', key: 'endereco', width: 34 },
  { header: 'Numero', key: 'numero', width: 12 },
  { header: 'Complemento', key: 'complemento', width: 22 },
  { header: 'Bairro', key: 'bairro', width: 22 },
  { header: 'Municipio', key: 'municipio', width: 22 },
  { header: 'UF', key: 'uf', width: 8 },
  { header: 'Fontes', key: 'fontes', width: 28 },
  { header: 'Adicionado', key: 'adicionado', width: 14 }
];

function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function textoCelula(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor !== 'object') return String(valor).trim();
  if (Array.isArray(valor.richText)) return valor.richText.map(item => item.text || '').join('').trim();
  if (valor.text) return String(valor.text).trim();
  if (valor.result !== undefined) return textoCelula(valor.result);
  return String(valor).trim();
}

function sanitizarCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarDateTimeSQL(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return formatarDateTimeSQL(new Date());
  const pad = valor => String(valor).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatarDataHoraCurta(valor) {
  if (!valor) return '';
  return String(valor).replace('T', ' ').slice(0, 19);
}

function formatarCnpj(valor) {
  const digitos = sanitizarCnpj(valor);
  if (digitos.length !== 14) return String(valor || '').trim();
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function separarTelefone(valor) {
  const bruto = String(valor || '').replace(/\D/g, '');
  const digitos = bruto.startsWith('55') && bruto.length > 11
    ? bruto.slice(2, 13)
    : bruto.slice(0, 11);
  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'consulta-cnpj';
}

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

async function carregarWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets[0]) throw criarHttpError(400, 'A planilha nao possui abas.');
  return workbook;
}

function listarAbasWorkbook(workbook) {
  return workbook.worksheets.map((worksheet, index) => ({
    nome: worksheet.name,
    index,
    total_linhas: Math.max(worksheet.rowCount - 1, 0)
  }));
}

function selecionarWorksheet(workbook, nomeAba = '') {
  const abas = listarAbasWorkbook(workbook);
  const nomeNormalizado = String(nomeAba || '').trim();
  const worksheet = nomeNormalizado
    ? workbook.worksheets.find(item => item.name === nomeNormalizado)
    : workbook.worksheets[0];

  if (!worksheet) {
    throw criarHttpError(400, 'Selecione uma aba valida da planilha.');
  }

  return { worksheet, abas };
}

async function lerWorksheet(buffer, nomeAba = '') {
  const workbook = await carregarWorkbook(buffer);
  return selecionarWorksheet(workbook, nomeAba).worksheet;
}

function obterCabecalhos(worksheet) {
  const header = worksheet.getRow(1);
  const colunas = [];

  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    const nome = textoCelula(header.getCell(col).value);
    if (nome) colunas.push({ nome, index: col });
  }

  if (colunas.length === 0) {
    throw criarHttpError(400, 'Nao foi possivel identificar cabecalhos na primeira linha.');
  }

  return colunas;
}

function sugerirColunaCnpj(colunas) {
  const encontrada = colunas.find(coluna => normalizarTexto(coluna.nome).includes('cnpj'));
  return encontrada?.nome || '';
}

function sugerirColunaRazaoSocial(colunas) {
  const termos = ['razao social', 'razao', 'empresa', 'nome empresa', 'cliente'];
  const encontrada = colunas.find(coluna => termos.some(termo => normalizarTexto(coluna.nome).includes(termo)));
  return encontrada?.nome || '';
}

function montarAmostras(worksheet, colunas) {
  const amostras = [];
  const limite = Math.min(worksheet.rowCount, 6);

  for (let rowIndex = 2; rowIndex <= limite; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const dados = {};
    colunas.forEach(coluna => {
      dados[coluna.nome] = textoCelula(row.getCell(coluna.index).value);
    });
    amostras.push({ row_index: rowIndex, dados });
  }

  return amostras;
}

async function previewPlanilha(req) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const workbook = await carregarWorkbook(arquivo.buffer);
  const { worksheet, abas } = selecionarWorksheet(workbook, mapeamento.aba || mapeamento.nomeAba);
  const colunas = obterCabecalhos(worksheet);

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    abas,
    total_linhas: Math.max(worksheet.rowCount - 1, 0),
    limite_linhas: LIMITE_LINHAS,
    colunas,
    sugestoes: {
      busca: sugerirColunaCnpj(colunas) || sugerirColunaRazaoSocial(colunas),
      tipo_busca: sugerirColunaCnpj(colunas) ? 'cnpj' : 'texto',
      cnpj: sugerirColunaCnpj(colunas),
      razao_social: sugerirColunaRazaoSocial(colunas)
    },
    amostras: montarAmostras(worksheet, colunas)
  };
}

function listarGooglePlacesKeys() {
  return googlePlacesService.listarGooglePlacesKeys();
}

function adicionarGooglePlacesKey(dados) {
  return googlePlacesService.adicionarGooglePlacesKey({
    nome: dados?.nome,
    apiKey: dados?.apiKey || dados?.api_key
  });
}

async function atualizarGooglePlacesKey(id, dados) {
  const chaveId = Number.parseInt(id, 10);
  if (!Number.isFinite(chaveId) || chaveId <= 0) {
    throw criarHttpError(400, 'Chave invalida.');
  }

  const atualizada = await googlePlacesService.atualizarGooglePlacesKey(chaveId, {
    nome: dados?.nome,
    apiKey: dados?.apiKey || dados?.api_key
  });

  if (!atualizada) {
    throw criarHttpError(404, 'Chave nao encontrada.');
  }

  return atualizada;
}

async function removerGooglePlacesKey(id) {
  const chaveId = Number.parseInt(id, 10);
  if (!Number.isFinite(chaveId) || chaveId <= 0) {
    throw criarHttpError(400, 'Chave invalida.');
  }

  const removida = await googlePlacesService.removerGooglePlacesKey(chaveId);
  if (!removida) {
    throw criarHttpError(404, 'Chave nao encontrada.');
  }
}

function parseMapeamento(valor) {
  if (!valor) return {};
  if (typeof valor === 'object') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return {};
  }
}

function normalizarInteiroPositivo(valor, fallback) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero) || numero < 0) return fallback;
  return numero;
}

let tabelaBuscasRealizadasDisponivel = null;
let tabelaBuscasTextoRealizadasDisponivel = null;

async function tabelaBuscasRealizadasExiste() {
  if (tabelaBuscasRealizadasDisponivel !== null) {
    return tabelaBuscasRealizadasDisponivel;
  }

  try {
    tabelaBuscasRealizadasDisponivel = await db.schema.hasTable(TABELA_BUSCAS_REALIZADAS);
  } catch (error) {
    tabelaBuscasRealizadasDisponivel = false;
  }

  return tabelaBuscasRealizadasDisponivel;
}

async function tabelaBuscasTextoRealizadasExiste() {
  if (tabelaBuscasTextoRealizadasDisponivel !== null) {
    return tabelaBuscasTextoRealizadasDisponivel;
  }

  try {
    tabelaBuscasTextoRealizadasDisponivel = await db.schema.hasTable(TABELA_BUSCAS_TEXTO_REALIZADAS);
  } catch (error) {
    tabelaBuscasTextoRealizadasDisponivel = false;
  }

  return tabelaBuscasTextoRealizadasDisponivel;
}

function parseJsonSeguro(valor, fallback = null) {
  if (!valor) return fallback;
  if (typeof valor === 'object') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
}

async function buscarCnpjJaBuscado(cnpj) {
  if (!await tabelaBuscasRealizadasExiste()) return null;

  return db(TABELA_BUSCAS_REALIZADAS)
    .where({ cnpj: sanitizarCnpj(cnpj) })
    .first();
}

function montarLinhaJaBuscada(item, registro) {
  const payload = parseJsonSeguro(registro.payload, {});
  const buscadoEm = registro.buscado_em || payload.ja_buscado_em || payload.consultado_em || null;
  const aviso = `CNPJ ja buscado${buscadoEm ? ` em ${formatarDataHoraCurta(buscadoEm)}` : ''}. Busca ignorada.`;
  const avisosExistentes = payload.avisos && payload.avisos !== '-'
    ? String(payload.avisos)
    : '';

  return {
    ...payload,
    row_index: item.row_index,
    status: 'encontrado',
    cnpj: formatarCnpj(item.cnpj),
    cnpj_digitos: item.cnpj,
    razao_social: payload.razao_social || registro.razao_social || '',
    nome_fantasia: payload.nome_fantasia || registro.nome_fantasia || '',
    email: payload.email || registro.email || '',
    telefone: payload.telefone || registro.telefone || '',
    cep: payload.cep || registro.cep || '',
    endereco: payload.endereco || registro.endereco || '',
    numero: payload.numero || registro.numero || '',
    complemento: payload.complemento || registro.complemento || '',
    bairro: payload.bairro || registro.bairro || '',
    municipio: payload.municipio || registro.municipio || '',
    uf: payload.uf || registro.uf || '',
    telefone_fonte: payload.telefone_fonte || registro.telefone_fonte || '',
    telefone_confianca: payload.telefone_confianca || registro.telefone_confianca || '',
    google_status: payload.google_status || 'ja_buscado',
    message: aviso,
    avisos: avisosExistentes ? `${avisosExistentes} | ${aviso}` : aviso,
    cache: true,
    busca_realizada: true,
    ja_buscado_em: buscadoEm,
    lead_id: null,
    adicionado: false
  };
}

function montarLinhaBuscaRealizada(registro, index) {
  const payload = parseJsonSeguro(registro.payload, {});
  const cnpj = sanitizarCnpj(registro.cnpj || payload.cnpj_digitos || payload.cnpj);
  const buscadoEm = registro.buscado_em || payload.consultado_em || null;

  return {
    ...payload,
    row_index: payload.row_index || index + 1,
    status: 'encontrado',
    cnpj: formatarCnpj(cnpj),
    cnpj_digitos: cnpj,
    razao_social: payload.razao_social || registro.razao_social || '',
    nome_fantasia: payload.nome_fantasia || registro.nome_fantasia || '',
    email: payload.email || registro.email || '',
    telefone: payload.telefone || registro.telefone || '',
    cep: payload.cep || registro.cep || '',
    endereco: payload.endereco || registro.endereco || '',
    numero: payload.numero || registro.numero || '',
    complemento: payload.complemento || registro.complemento || '',
    bairro: payload.bairro || registro.bairro || '',
    municipio: payload.municipio || registro.municipio || '',
    uf: payload.uf || registro.uf || '',
    telefone_fonte: payload.telefone_fonte || registro.telefone_fonte || '',
    telefone_confianca: payload.telefone_confianca || registro.telefone_confianca || '',
    google_status: payload.google_status || 'ja_buscado',
    message: `CNPJ ja buscado${buscadoEm ? ` em ${formatarDataHoraCurta(buscadoEm)}` : ''}.`,
    cache: true,
    busca_realizada: true,
    ja_buscado_em: buscadoEm,
    lead_id: null,
    adicionado: false
  };
}
function montarLinhaBuscaTextoRealizada(registro, index) {
  const payload = parseJsonSeguro(registro.payload, {});
  const cnpj = sanitizarCnpj(registro.cnpj || payload.cnpj_digitos || payload.cnpj);
  const buscadoEm = registro.buscado_em || payload.consultado_em || null;
  const aviso = `Busca por texto ja realizada${buscadoEm ? ` em ${formatarDataHoraCurta(buscadoEm)}` : ''}.`;
  const avisosExistentes = payload.avisos && payload.avisos !== '-'
    ? String(payload.avisos)
    : '';

  return {
    ...payload,
    row_index: payload.row_index || `texto-${registro.id || index + 1}`,
    status: 'encontrado',
    cnpj: cnpj ? formatarCnpj(cnpj) : '',
    cnpj_digitos: cnpj,
    razao_social: payload.razao_social || registro.razao_social || registro.termo_busca || '',
    nome_fantasia: payload.nome_fantasia || registro.nome_fantasia || '',
    email: payload.email || registro.email || '',
    telefone: payload.telefone || registro.telefone || '',
    telefone_google_places: payload.telefone_google_places || registro.telefone || '',
    telefone_fonte: payload.telefone_fonte || registro.telefone_fonte || '',
    telefone_confianca: payload.telefone_confianca || registro.telefone_confianca || '',
    google_status: payload.google_status || 'encontrado_por_texto',
    google_detalhe: payload.google_detalhe || registro.google_detalhe || '',
    message: aviso,
    avisos: avisosExistentes ? `${avisosExistentes} | ${aviso}` : aviso,
    cache: true,
    busca_realizada: true,
    busca_por_texto: true,
    ja_buscado_em: buscadoEm,
    lead_id: null,
    adicionado: false
  };
}

function timestampLinhaHistorico(linha) {
  const data = new Date(linha?.ja_buscado_em || linha?.consultado_em || 0);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

async function buscarLeadsExistentesPorCnpj(cnpjs = [], usuarioId) {
  const documentos = [...new Set(cnpjs.map(sanitizarCnpj).filter(cnpj => cnpj.length === 14))];
  if (documentos.length === 0 || !usuarioId) return new Map();

  const leads = await ClienteSecreto.query()
    .select('id', 'cnpj_digitos')
    .where('criado_por_id', Number(usuarioId))
    .whereIn('cnpj_digitos', documentos);

  return new Map(leads.map(lead => [lead.cnpj_digitos, lead]));
}

function aplicarLeadExistente(linha, leadsPorCnpj) {
  const cnpj = sanitizarCnpj(linha?.cnpj_digitos || linha?.cnpj);
  const lead = leadsPorCnpj.get(cnpj);

  if (!lead) return linha;

  return {
    ...linha,
    lead_id: lead.id,
    adicionado: true
  };
}

async function listarBuscasRealizadas(usuarioId) {
  const temTabelaCnpj = await tabelaBuscasRealizadasExiste();
  const temTabelaTexto = await tabelaBuscasTextoRealizadasExiste();

  if (!temTabelaCnpj && !temTabelaTexto) {
    return {
      total_cnpjs: 0,
      total_consultados: 0,
      total_ja_buscados: 0,
      requisicoes_externas: 0,
      fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita', 'Google Places'],
      linhas: []
    };
  }

  const registrosCnpj = temTabelaCnpj
    ? await db(TABELA_BUSCAS_REALIZADAS).orderBy('buscado_em', 'desc').orderBy('id', 'desc')
    : [];
  const registrosTexto = temTabelaTexto
    ? await db(TABELA_BUSCAS_TEXTO_REALIZADAS).orderBy('buscado_em', 'desc').orderBy('id', 'desc')
    : [];

  const linhasBase = [
    ...registrosCnpj.map(montarLinhaBuscaRealizada),
    ...registrosTexto.map(montarLinhaBuscaTextoRealizada)
  ].sort((a, b) => timestampLinhaHistorico(b) - timestampLinhaHistorico(a));
  const leadsPorCnpj = await buscarLeadsExistentesPorCnpj(linhasBase.map(linha => linha.cnpj_digitos), usuarioId);
  const linhas = linhasBase.map(linha => aplicarLeadExistente(linha, leadsPorCnpj));

  return {
    arquivo: 'historico-cnpj',
    aba: 'Buscas realizadas',
    total_cnpjs: linhas.length,
    total_consultados: linhas.length,
    total_ja_buscados: linhas.length,
    requisicoes_externas: 0,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita', 'Google Places'],
    linhas
  };
}

async function excluirBuscaRealizada(cnpj) {
  const cnpjDigitos = sanitizarCnpj(cnpj);
  if (cnpjDigitos.length !== 14) {
    throw criarHttpError(400, 'Informe um CNPJ valido para excluir.');
  }

  let removidos = 0;
  if (await tabelaBuscasRealizadasExiste()) {
    removidos += await db(TABELA_BUSCAS_REALIZADAS)
      .where({ cnpj: cnpjDigitos })
      .delete();
  }

  if (await tabelaBuscasTextoRealizadasExiste()) {
    removidos += await db(TABELA_BUSCAS_TEXTO_REALIZADAS)
      .where({ cnpj: cnpjDigitos })
      .delete();
  }

  return removidos;
}

async function limparBuscasRealizadas() {
  let removidos = 0;
  if (await tabelaBuscasRealizadasExiste()) {
    removidos += await db(TABELA_BUSCAS_REALIZADAS).delete();
  }
  if (await tabelaBuscasTextoRealizadasExiste()) {
    removidos += await db(TABELA_BUSCAS_TEXTO_REALIZADAS).delete();
  }
  return removidos;
}

function normalizarCnpjsReconsulta(cnpjs = []) {
  const lista = Array.isArray(cnpjs) ? cnpjs : [cnpjs];
  return [...new Set(lista.map(sanitizarCnpj).filter(cnpj => cnpj.length === 14))];
}

async function reconsultarBuscasRealizadas(cnpjs = [], usuarioId, opcoes = {}) {
  const documentos = normalizarCnpjsReconsulta(cnpjs);
  if (documentos.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos um CNPJ valido para buscar novamente.');
  }

  const modoBuscaTelefone = ['sem_telefone', 'somente_google', 'nao'].includes(opcoes.buscaTelefone)
    ? opcoes.buscaTelefone
    : 'sem_telefone';
  const leadsPorCnpj = await buscarLeadsExistentesPorCnpj(documentos, usuarioId);
  const linhas = [];
  let requisicoesExternas = 0;

  for (const [index, cnpj] of documentos.entries()) {
    try {
      const dados = await enriquecerTelefoneFallback(await cnpjService.consultarCnpj(cnpj), modoBuscaTelefone);
      if (!dados.cache) requisicoesExternas += 1;
      const linha = aplicarLeadExistente(montarLinhaConsulta({ row_index: index + 1, cnpj }, dados), leadsPorCnpj);
      linhas.push(linha);
      await salvarCnpjBuscado(linha);

      if (!dados.cache && index < documentos.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      linhas.push({
        row_index: index + 1,
        status: 'erro',
        cnpj: formatarCnpj(cnpj),
        cnpj_digitos: cnpj,
        message: error.message || 'Erro ao consultar CNPJ.',
        code: error.code || 'erro',
        adicionado: false
      });

      if (index < documentos.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    }
  }

  return {
    arquivo: 'historico-cnpj',
    aba: 'Buscas realizadas',
    total_cnpjs: linhas.length,
    total_consultados: linhas.length,
    total_ja_buscados: 0,
    requisicoes_externas: requisicoesExternas,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita'],
    linhas
  };
}
async function salvarCnpjBuscado(linha) {
  if (!linha || linha.status !== 'encontrado' || !linha.cnpj_digitos) return;
  if (!await tabelaBuscasRealizadasExiste()) return;

  const agora = formatarDateTimeSQL();
  const registro = {
    cnpj: sanitizarCnpj(linha.cnpj_digitos),
    razao_social: linha.razao_social || null,
    nome_fantasia: linha.nome_fantasia || null,
    email: linha.email || null,
    telefone: linha.telefone || null,
    cep: linha.cep || null,
    endereco: linha.endereco || null,
    numero: linha.numero || null,
    complemento: linha.complemento || null,
    bairro: linha.bairro || null,
    municipio: linha.municipio || null,
    uf: linha.uf || null,
    telefone_fonte: linha.telefone_fonte || null,
    telefone_confianca: linha.telefone_confianca || null,
    payload: JSON.stringify({ ...linha, busca_realizada: false, ja_buscado_em: null }),
    buscado_em: linha.consultado_em ? formatarDateTimeSQL(linha.consultado_em) : agora,
    updated_at: agora
  };

  await db(TABELA_BUSCAS_REALIZADAS)
    .insert({
      ...registro,
      created_at: agora
    })
    .onConflict('cnpj')
    .merge(registro);
}

function chaveBuscaTextoLinha(linha) {
  const cnpj = sanitizarCnpj(linha?.cnpj_digitos || linha?.cnpj);
  const place = linha?.google_places?.place || {};
  const partes = [
    'texto',
    linha?.row_index || '',
    cnpj,
    place.id || place.place_id || place.nome || linha?.google_detalhe || linha?.nome_fantasia || linha?.telefone || ''
  ];

  return partes
    .map(parte => normalizarTexto(parte))
    .filter(Boolean)
    .join(':')
    .slice(0, 255) || `texto:${Date.now()}`;
}

async function salvarBuscaTextoRealizada(linha) {
  if (!linha || linha.status !== 'encontrado' || !linha.busca_por_texto) return;
  if (!await tabelaBuscasTextoRealizadasExiste()) return;

  const agora = formatarDateTimeSQL();
  const place = linha.google_places?.place || {};
  const termoBusca = String(linha.google_places?.query || linha.razao_social || linha.nome_fantasia || '').trim();
  const registro = {
    chave: chaveBuscaTextoLinha(linha),
    termo_busca: termoBusca.slice(0, 255) || 'Busca por texto',
    cnpj: sanitizarCnpj(linha.cnpj_digitos || linha.cnpj) || null,
    razao_social: linha.razao_social || null,
    nome_fantasia: linha.nome_fantasia || null,
    email: linha.email || null,
    telefone: linha.telefone || linha.telefone_google_places || null,
    telefone_fonte: linha.telefone_fonte || null,
    telefone_confianca: linha.telefone_confianca || null,
    google_place_id: place.id || place.place_id || null,
    google_detalhe: linha.google_detalhe || place.endereco || null,
    payload: JSON.stringify({ ...linha, busca_realizada: false, ja_buscado_em: null }),
    buscado_em: linha.consultado_em ? formatarDateTimeSQL(linha.consultado_em) : agora,
    updated_at: agora
  };

  await db(TABELA_BUSCAS_TEXTO_REALIZADAS)
    .insert({
      ...registro,
      created_at: agora
    })
    .onConflict('chave')
    .merge(registro);
}

function extrairItensBusca(worksheet, { colunaBusca, tipoBusca, colunaCnpj }) {
  const colunas = obterCabecalhos(worksheet);
  const headerMap = new Map(colunas.map(coluna => [coluna.nome, coluna.index]));
  const colunaIndex = headerMap.get(colunaBusca);
  const colunaCnpjIndex = colunaCnpj ? headerMap.get(colunaCnpj) : null;
  const tipo = tipoBusca === 'texto' ? 'texto' : 'cnpj';

  if (!colunaIndex) throw criarHttpError(400, 'Selecione uma coluna de busca valida.');

  const vistos = new Set();
  const linhas = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const termoOriginal = textoCelula(row.getCell(colunaIndex).value);
    const cnpjTexto = tipo === 'texto' && colunaCnpjIndex ? sanitizarCnpj(textoCelula(row.getCell(colunaCnpjIndex).value)) : '';
    const cnpj = tipo === 'cnpj' ? sanitizarCnpj(termoOriginal) : cnpjTexto.length === 14 ? cnpjTexto : '';
    const textoBusca = tipo === 'texto' ? termoOriginal : '';

    if (tipo === 'cnpj' && cnpj.length !== 14) continue;
    if (tipo === 'texto' && !textoBusca) continue;

    const chave = tipo === 'cnpj' ? `cnpj:${cnpj}` : `texto:${rowIndex}:${normalizarTexto(textoBusca)}:${cnpj}`;
    if (vistos.has(chave)) continue;

    vistos.add(chave);
    linhas.push({
      row_index: rowIndex,
      tipo_busca: tipo,
      termo_busca: termoOriginal,
      cnpj,
      texto_busca: textoBusca,
      razao_social_busca: textoBusca
    });
  }

  if (linhas.length === 0) {
    throw criarHttpError(400, tipo === 'cnpj'
      ? 'Nenhum CNPJ valido foi encontrado na coluna selecionada.'
      : 'Nenhum texto foi encontrado na coluna selecionada.');
  }

  return linhas;
}

function montarLinhaConsulta(item, dados) {
  const telefonesPorFonte = montarTelefonesPorFonte(dados);
  const alertas = dados.alertas || [];

  return {
    row_index: item.row_index,
    status: 'encontrado',
    cnpj: formatarCnpj(item.cnpj),
    cnpj_digitos: item.cnpj,
    razao_social: dados.razaoSocial || '',
    nome_fantasia: dados.nomeFantasia || '',
    situacao_cadastral: dados.situacaoCadastral || '',
    email: dados.email || '',
    telefone: dados.telefone || '',
    telefone_open_cnpj: telefonesPorFonte.openCnpj,
    telefone_cnpjws: telefonesPorFonte.cnpjws,
    telefone_minha_receita: telefonesPorFonte.minhaReceita,
    telefone_google_places: telefonesPorFonte.googlePlaces,
    google_status: dados.googlePlaces?.encontrado
      ? 'encontrado'
      : dados.googlePlaces?.motivo || '',
    google_detalhe: dados.googlePlaces?.encontrado
      ? dados.googlePlaces?.place?.nome || ''
      : dados.googlePlaces?.message || dados.googlePlaces?.motivo || '',
    avisos: montarTextoAvisos(alertas),
    telefone_fonte: dados.telefoneFonte || (dados.telefone ? dados.fontesPorCampo?.telefone?.fonte || dados.fonte || '' : ''),
    telefone_confianca: dados.telefoneConfianca || dados.fontesPorCampo?.telefone?.confianca || '',
    cep: dados.cep || '',
    endereco: dados.endereco || '',
    numero: dados.numero || '',
    complemento: dados.complemento || '',
    bairro: dados.bairro || '',
    municipio: dados.municipio || '',
    uf: dados.uf || '',
    fontes: dados.fontesComSucesso || [],
    fontes_com_erro: dados.fontesComErro || [],
    fontes_por_campo: dados.fontesPorCampo || {},
    alertas,
    google_places: dados.googlePlaces || null,
    cache: Boolean(dados.cache),
    consultado_em: dados.consultadoEm || null,
    lead_id: null,
    adicionado: false
  };
}

function montarLinhaGoogleTexto(item, empresa, resultadoGoogle, erroOriginal = null, indice = 0) {
  const telefone = empresa.telefone || '';
  const avisoOrigem = erroOriginal
    ? `Consulta por CNPJ falhou (${erroOriginal.message || 'erro'}). Resultado retornado por texto.`
    : 'Resultado retornado por texto.';

  return {
    row_index: indice ? `${item.row_index}.${indice + 1}` : item.row_index,
    status: 'encontrado',
    cnpj: item.cnpj ? formatarCnpj(item.cnpj) : '',
    cnpj_digitos: item.cnpj || '',
    razao_social: item.texto_busca || item.razao_social_busca || empresa.nome || '',
    nome_fantasia: empresa.nome || '',
    situacao_cadastral: '',
    email: '',
    telefone,
    telefone_open_cnpj: '',
    telefone_cnpjws: '',
    telefone_minha_receita: '',
    telefone_google_places: telefone,
    google_status: 'encontrado_por_texto',
    google_detalhe: empresa.endereco || empresa.nome || resultadoGoogle.query || '',
    avisos: avisoOrigem,
    telefone_fonte: telefone ? 'Google Places' : '',
    telefone_confianca: empresa.score >= 3 ? 'alta' : 'media',
    cep: '',
    endereco: empresa.endereco || '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
    fontes: ['Google Places'],
    fontes_com_erro: [],
    fontes_por_campo: {},
    alertas: [{ tipo: 'busca_texto', campo: 'texto', mensagem: avisoOrigem }],
    google_places: {
      encontrado: true,
      telefone,
      fonte: 'Google Places',
      query: resultadoGoogle.query || '',
      place: empresa
    },
    cache: false,
    consultado_em: new Date().toISOString(),
    busca_por_texto: true,
    lead_id: null,
    adicionado: false
  };
}

async function buscarLinhasPorTexto(item, erroOriginal = null) {
  const texto = String(item?.texto_busca || item?.razao_social_busca || '').trim();
  if (!texto) return [];

  const resultadoGoogle = await googlePlacesService.buscarEmpresasPorTexto({ razaoSocial: texto, nomeFantasia: texto });
  if (!resultadoGoogle.encontrado || !Array.isArray(resultadoGoogle.empresas) || resultadoGoogle.empresas.length === 0) {
    return [];
  }

  return resultadoGoogle.empresas.map((empresa, index) => montarLinhaGoogleTexto(item, empresa, resultadoGoogle, erroOriginal, index));
}

function montarLinhaErroConsulta(item, error) {
  return {
    row_index: item.row_index,
    status: 'erro',
    cnpj: item.cnpj ? formatarCnpj(item.cnpj) : '',
    cnpj_digitos: item.cnpj || '',
    razao_social: item.texto_busca || item.razao_social_busca || '',
    message: error.message || 'Erro ao consultar CNPJ.',
    code: error.code || 'erro',
    adicionado: false
  };
}
function montarTextoAvisos(alertas = []) {
  return alertas
    .map(alerta => alerta?.mensagem || '')
    .filter(Boolean)
    .join(' | ');
}

function montarTelefonesPorFonte(dados = {}) {
  const telefones = {
    openCnpj: '',
    cnpjws: '',
    minhaReceita: '',
    googlePlaces: dados.googlePlaces?.encontrado ? dados.googlePlaces.telefone || '' : ''
  };

  const porFonte = {
    'Open CNPJ': 'openCnpj',
    CNPJws: 'cnpjws',
    'Minha Receita': 'minhaReceita',
    'Google Places': 'googlePlaces'
  };

  (dados.alternativasPorCampo?.telefone || []).forEach(item => {
    const chave = porFonte[item.fonte];
    if (chave && item.valor && !telefones[chave]) {
      telefones[chave] = item.valor;
    }
  });

  const fontePrincipal = dados.telefoneFonte || dados.fontesPorCampo?.telefone?.fonte || dados.fonte || '';
  const chavePrincipal = porFonte[fontePrincipal];
  if (chavePrincipal && dados.telefone && !telefones[chavePrincipal]) {
    telefones[chavePrincipal] = dados.telefone;
  }

  return telefones;
}

function aplicarTelefoneEncontrado(dados, resultado, campoResultado, opcoes = {}) {
  const substituirTelefone = Boolean(opcoes.substituirTelefone);
  const telefoneAtual = substituirTelefone ? '' : dados.telefone;

  return {
    ...dados,
    telefone: telefoneAtual || resultado.telefone,
    telefoneFonte: telefoneAtual ? dados.telefoneFonte : resultado.fonte,
    telefoneConfianca: telefoneAtual ? dados.telefoneConfianca : resultado.confianca,
    [campoResultado]: resultado,
    fontesComSucesso: Array.from(new Set([...(dados.fontesComSucesso || []), resultado.fonte])),
    fontesPorCampo: {
      ...(dados.fontesPorCampo || {}),
      telefone: telefoneAtual
        ? dados.fontesPorCampo?.telefone
        : {
            fonte: resultado.fonte,
            atualizadoEm: null,
            confianca: resultado.confianca,
            divergente: false
          }
    },
    alternativasPorCampo: {
      ...(dados.alternativasPorCampo || {}),
      telefone: [
        ...(dados.alternativasPorCampo?.telefone || []),
        {
          fonte: resultado.fonte,
          valor: resultado.telefone,
          atualizadoEm: null
        }
      ]
    }
  };
}

function adicionarAlertaTelefone(dados, tipo, mensagem) {
  return {
    ...dados,
    alertas: [
      ...(dados.alertas || []),
      {
        tipo,
        campo: 'telefone',
        mensagem
      }
    ]
  };
}

function montarAlertasTentativasGoogle(resultadoGoogle = {}) {
  return (resultadoGoogle.tentativas_google || [])
    .filter(tentativa => ['limite', 'pausado'].includes(tentativa.motivo))
    .map(tentativa => ({
      tipo: 'google_limite',
      campo: 'telefone',
      mensagem: tentativa.motivo === 'pausado'
        ? `Google Places: ${tentativa.env || `chave ${tentativa.index}`} esta pausada por limite; tentando proxima chave.`
        : `Google Places: ${tentativa.env || `chave ${tentativa.index}`} atingiu o limite; tentando proxima chave.`
    }));
}

function adicionarAlertasGoogle(dados, resultadoGoogle) {
  const alertasGoogle = montarAlertasTentativasGoogle(resultadoGoogle);
  if (alertasGoogle.length === 0) return dados;

  return {
    ...dados,
    alertas: [
      ...(dados.alertas || []),
      ...alertasGoogle
    ]
  };
}

function limparTelefonePrincipal(dados) {
  const fontesPorCampo = { ...(dados.fontesPorCampo || {}) };
  delete fontesPorCampo.telefone;

  return {
    ...dados,
    telefone: '',
    telefoneFonte: '',
    telefoneConfianca: '',
    fontesPorCampo
  };
}

async function enriquecerTelefoneFallback(dados, modoBusca = 'sem_telefone') {
  if (modoBusca === 'nao') {
    return {
      ...dados,
      googlePlaces: {
        encontrado: false,
        motivo: 'desativado'
      }
    };
  }

  const buscarSomenteGoogle = modoBusca === 'somente_google';

  if (modoBusca === 'sem_telefone' && String(dados?.telefone || '').trim()) {
    return {
      ...dados,
      googlePlaces: {
        encontrado: false,
        motivo: 'ignorado_com_telefone'
      }
    };
  }

  const resultadoGoogle = await googlePlacesService.buscarTelefoneEmpresa(dados);
  if (resultadoGoogle.encontrado) {
    return adicionarAlertasGoogle(
      aplicarTelefoneEncontrado(dados, resultadoGoogle, 'googlePlaces', {
        substituirTelefone: buscarSomenteGoogle
      }),
      resultadoGoogle
    );
  }

  const dadosBase = buscarSomenteGoogle ? limparTelefonePrincipal(dados) : dados;
  const dadosComAlertasGoogle = adicionarAlertasGoogle({
    ...dadosBase,
    googlePlaces: resultadoGoogle
  }, resultadoGoogle);

  return adicionarAlertaTelefone(dadosComAlertasGoogle, 'telefone_google', resultadoGoogle.motivo === 'sem_chave'
    ? 'Google Places nao configurado para buscar telefone. Cadastre uma chave nesta tela.'
    : resultadoGoogle.motivo === 'credenciais_esgotadas'
      ? 'Todas as credenciais do Google Places cadastradas esgotaram hoje. Volte amanha para continuar usando a busca extra.'
      : resultadoGoogle.motivo === 'limite' || resultadoGoogle.motivo === 'pausado'
        ? 'Todas as chaves do Google Places atingiram limite ou estao pausadas; a busca continuou sem telefone extra.'
        : 'Telefone nao encontrado no Google Places.');
}

async function consultarPlanilha(req) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const worksheet = await lerWorksheet(arquivo.buffer, mapeamento.aba || mapeamento.nomeAba);
  const usuarioId = req.usuario?.id;
  const modoBuscaTelefone = ['sem_telefone', 'somente_google', 'nao'].includes(mapeamento.buscaTelefone)
    ? mapeamento.buscaTelefone
    : 'sem_telefone';

  const colunaBusca = mapeamento.colunaBusca || mapeamento.busca || mapeamento.cnpj || '';
  const tipoBusca = mapeamento.tipoBusca === 'texto' ? 'texto' : 'cnpj';
  const colunaCnpjTexto = tipoBusca === 'texto' ? (mapeamento.colunaCnpjTexto || mapeamento.colunaCnpj || '') : '';

  if (!colunaBusca) {
    throw criarHttpError(400, 'Selecione a coluna de busca.');
  }

  const cnpjsTodos = extrairItensBusca(worksheet, { colunaBusca, tipoBusca, colunaCnpj: colunaCnpjTexto });
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha itens pendentes nesse lote.');
  }

  const linhas = [];
  const jaBuscados = [];
  const leadsPorCnpj = await buscarLeadsExistentesPorCnpj(cnpjs.map(item => item.cnpj).filter(Boolean), usuarioId);
  let requisicoesExternas = 0;
  const proximoInicio = inicio + cnpjs.length;

  for (const [index, item] of cnpjs.entries()) {
    try {
      if (item.tipo_busca === 'texto') {
        const linhasTexto = await buscarLinhasPorTexto(item);
        if (linhasTexto.length > 0) {
          linhas.push(...linhasTexto);
          for (const linhaTexto of linhasTexto) {
            await salvarBuscaTextoRealizada(linhaTexto);
          }
          requisicoesExternas += 1;
        } else {
          linhas.push(montarLinhaErroConsulta(item, new Error('Nenhum resultado encontrado para o texto informado.')));
        }
        continue;
      }

      const registroJaBuscado = item.cnpj ? await buscarCnpjJaBuscado(item.cnpj) : null;
      if (registroJaBuscado) {
        const linhaJaBuscada = aplicarLeadExistente(montarLinhaJaBuscada(item, registroJaBuscado), leadsPorCnpj);
        linhas.push(linhaJaBuscada);
        jaBuscados.push(linhaJaBuscada);
        continue;
      }

      const dados = await enriquecerTelefoneFallback(await cnpjService.consultarCnpj(item.cnpj), modoBuscaTelefone);
      if (!dados.cache) requisicoesExternas += 1;
      const linha = aplicarLeadExistente(montarLinhaConsulta(item, dados), leadsPorCnpj);
      linhas.push(linha);
      await salvarCnpjBuscado(linha);
      if (!dados.cache && index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      const linhasTextoFallback = await buscarLinhasPorTexto(item, error);
      if (linhasTextoFallback.length > 0) {
        linhas.push(...linhasTextoFallback);
        for (const linhaTextoFallback of linhasTextoFallback) {
          await salvarBuscaTextoRealizada(linhaTextoFallback);
        }
        requisicoesExternas += 1;
      } else {
        linhas.push(montarLinhaErroConsulta(item, error));
      }

      if (index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    }
  }
  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_cnpjs: cnpjsTodos.length,
    inicio,
    limite,
    proximo_inicio: proximoInicio < cnpjsTodos.length ? proximoInicio : null,
    tem_proximo_lote: proximoInicio < cnpjsTodos.length,
    total_consultados: linhas.length,
    total_ja_buscados: jaBuscados.length,
    ja_buscados: jaBuscados,
    requisicoes_externas: requisicoesExternas,
    intervalo_ms: INTERVALO_CONSULTA_MS,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita'],
    colunas_normalizadas: [
      'cnpj',
      'razao_social',
      'nome_fantasia',
      'situacao_cadastral',
      'email',
      'telefone',
      'telefone_open_cnpj',
      'telefone_cnpjws',
      'telefone_minha_receita',
      'telefone_google_places',
      'google_status',
      'google_detalhe',
      'avisos',
      'telefone_fonte',
      'telefone_confianca',
      'cep',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'municipio',
      'uf'
    ],
    linhas
  };
}

async function consultarPlanilhaStream(req, onEvento) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const worksheet = await lerWorksheet(arquivo.buffer, mapeamento.aba || mapeamento.nomeAba);
  const usuarioId = req.usuario?.id;
  const modoBuscaTelefone = ['sem_telefone', 'somente_google', 'nao'].includes(mapeamento.buscaTelefone)
    ? mapeamento.buscaTelefone
    : 'sem_telefone';

  const colunaBusca = mapeamento.colunaBusca || mapeamento.busca || mapeamento.cnpj || '';
  const tipoBusca = mapeamento.tipoBusca === 'texto' ? 'texto' : 'cnpj';
  const colunaCnpjTexto = tipoBusca === 'texto' ? (mapeamento.colunaCnpjTexto || mapeamento.colunaCnpj || '') : '';

  if (!colunaBusca) {
    throw criarHttpError(400, 'Selecione a coluna de busca.');
  }

  const cnpjsTodos = extrairItensBusca(worksheet, { colunaBusca, tipoBusca, colunaCnpj: colunaCnpjTexto });
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha itens pendentes nesse lote.');
  }

  const proximoInicio = inicio + cnpjs.length;
  const meta = {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_cnpjs: cnpjsTodos.length,
    inicio,
    limite,
    proximo_inicio: proximoInicio < cnpjsTodos.length ? proximoInicio : null,
    tem_proximo_lote: proximoInicio < cnpjsTodos.length,
    total_lote: cnpjs.length,
    intervalo_ms: INTERVALO_CONSULTA_MS,
    fontes: ['Open CNPJ', 'CNPJws', 'Minha Receita'],
    colunas_normalizadas: [
      'cnpj',
      'razao_social',
      'nome_fantasia',
      'situacao_cadastral',
      'email',
      'telefone',
      'telefone_open_cnpj',
      'telefone_cnpjws',
      'telefone_minha_receita',
      'telefone_google_places',
      'google_status',
      'google_detalhe',
      'avisos',
      'telefone_fonte',
      'telefone_confianca',
      'cep',
      'endereco',
      'numero',
      'complemento',
      'bairro',
      'municipio',
      'uf'
    ]
  };
  let requisicoesExternas = 0;
  let totalJaBuscados = 0;
  const leadsPorCnpj = await buscarLeadsExistentesPorCnpj(cnpjs.map(item => item.cnpj).filter(Boolean), usuarioId);

  await onEvento({ tipo: 'inicio', ...meta });

  for (const [index, item] of cnpjs.entries()) {
    await onEvento({
      tipo: 'progresso',
      atual: index + 1,
      total_lote: cnpjs.length,
      cnpj: item.cnpj ? formatarCnpj(item.cnpj) : item.texto_busca || item.razao_social_busca || '',
      cnpj_digitos: item.cnpj || ''
    });

    try {
      if (item.tipo_busca === 'texto') {
        const linhasTexto = await buscarLinhasPorTexto(item);
        if (linhasTexto.length > 0) {
          requisicoesExternas += 1;
          for (const linhaTexto of linhasTexto) {
            await salvarBuscaTextoRealizada(linhaTexto);
            await onEvento({
              tipo: 'linha',
              linha: linhaTexto,
              requisicoes_externas: requisicoesExternas,
              total_ja_buscados: totalJaBuscados
            });
          }
        } else {
          await onEvento({
            tipo: 'linha',
            linha: montarLinhaErroConsulta(item, new Error('Nenhum resultado encontrado para o texto informado.')),
            requisicoes_externas: requisicoesExternas
          });
        }
        continue;
      }

      const registroJaBuscado = item.cnpj ? await buscarCnpjJaBuscado(item.cnpj) : null;
      if (registroJaBuscado) {
        const linhaJaBuscada = aplicarLeadExistente(montarLinhaJaBuscada(item, registroJaBuscado), leadsPorCnpj);
        totalJaBuscados += 1;
        await onEvento({
          tipo: 'linha',
          linha: linhaJaBuscada,
          requisicoes_externas: requisicoesExternas,
          total_ja_buscados: totalJaBuscados
        });
        continue;
      }

      const dados = await enriquecerTelefoneFallback(await cnpjService.consultarCnpj(item.cnpj), modoBuscaTelefone);
      if (!dados.cache) requisicoesExternas += 1;
      const linha = aplicarLeadExistente(montarLinhaConsulta(item, dados), leadsPorCnpj);
      await salvarCnpjBuscado(linha);
      await onEvento({
        tipo: 'linha',
        linha,
        requisicoes_externas: requisicoesExternas,
        total_ja_buscados: totalJaBuscados
      });

      if (!dados.cache && index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      const linhasTextoFallback = await buscarLinhasPorTexto(item, error);
      if (linhasTextoFallback.length > 0) {
        requisicoesExternas += 1;
        for (const linhaTextoFallback of linhasTextoFallback) {
          await salvarBuscaTextoRealizada(linhaTextoFallback);
          await onEvento({
            tipo: 'linha',
            linha: linhaTextoFallback,
            requisicoes_externas: requisicoesExternas,
            total_ja_buscados: totalJaBuscados
          });
        }
      } else {
        await onEvento({
          tipo: 'linha',
          linha: montarLinhaErroConsulta(item, error),
          requisicoes_externas: requisicoesExternas
        });
      }

      if (index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    }
  }

  await onEvento({
    tipo: 'fim',
    ...meta,
    total_consultados: cnpjs.length,
    total_ja_buscados: totalJaBuscados,
    requisicoes_externas: requisicoesExternas
  });
}

function montarPayloadCliente(linha) {
  const telefone = separarTelefone(linha.telefone);
  const nome = linha.razao_social || linha.nome_fantasia || linha.cnpj;

  return {
    nome,
    razao_social: linha.razao_social || null,
    cnpj: linha.cnpj || linha.cnpj_digitos,
    responsavel_tipo: 'rl',
    email: linha.email || null,
    fixo_ddd: telefone.ddd,
    fixo_numero: telefone.numero
  };
}
async function adicionarLeads(linhas = [], usuarioId) {
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw criarHttpError(400, 'Selecione ao menos uma linha consultada.');
  }

  const resultado = {
    criados: 0,
    ignorados: 0,
    erros: [],
    leads: []
  };
  const vistos = new Set();
  const leadsPorCnpj = await buscarLeadsExistentesPorCnpj(
    linhas.map(linha => linha?.cnpj_digitos || linha?.cnpj),
    usuarioId
  );

  for (const linha of linhas) {
    const cnpj = sanitizarCnpj(linha?.cnpj_digitos || linha?.cnpj);
    if (cnpj.length !== 14 || vistos.has(cnpj)) {
      resultado.ignorados += 1;
      continue;
    }
    vistos.add(cnpj);

    const leadExistente = leadsPorCnpj.get(cnpj);
    if (leadExistente) {
      resultado.ignorados += 1;
      resultado.leads.push({
        id: leadExistente.id,
        cnpj_digitos: cnpj,
        existente: true
      });
      continue;
    }

    try {
      const criado = await clienteSecretoService.criarClienteSecreto(montarPayloadCliente({ ...linha, cnpj_digitos: cnpj }), usuarioId);
      resultado.criados += 1;
      resultado.leads.push({
        id: criado.id,
        cnpj_digitos: cnpj
      });
    } catch (error) {
      resultado.erros.push({
        cnpj: formatarCnpj(cnpj),
        message: error.message || 'Erro ao adicionar lead.'
      });
    }
  }

  return resultado;
}

function valorExportacao(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Nao';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
}

function numeroLinhaOriginal(rowIndex) {
  const numero = Number.parseInt(String(rowIndex || '').split('.')[0], 10);
  return Number.isFinite(numero) && numero > 1 ? numero : null;
}

function telefoneEncontradoLinha(linha = {}) {
  return [
    linha.telefone,
    linha.telefone_google_places,
    linha.telefone_open_cnpj,
    linha.telefone_cnpjws,
    linha.telefone_minha_receita
  ].find(valor => String(valor || '').trim()) || '';
}

function montarTelefonesPorLinhaOriginal(linhas = []) {
  const mapa = new Map();

  linhas.forEach(linha => {
    const rowIndex = numeroLinhaOriginal(linha?.row_index);
    const telefone = String(telefoneEncontradoLinha(linha) || '').trim();
    if (!rowIndex || !telefone) return;

    const telefones = mapa.get(rowIndex) || [];
    if (!telefones.includes(telefone)) telefones.push(telefone);
    mapa.set(rowIndex, telefones);
  });

  return mapa;
}

function obterColunaTelefoneEncontrado(worksheet) {
  const header = worksheet.getRow(1);
  let colunaLivre = 1;

  for (let col = 1; col <= Math.max(worksheet.columnCount, header.cellCount); col += 1) {
    const texto = normalizarTexto(textoCelula(header.getCell(col).value));
    if (texto === 'telefone encontrado') return col;
    if (texto) colunaLivre = col + 1;
  }

  return colunaLivre;
}

async function gerarXlsxOriginalComTelefones(linhas = [], opcoes = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(opcoes.arquivoOriginal);
  workbook.creator = workbook.creator || 'Pos-venda';
  workbook.modified = new Date();

  const { worksheet } = selecionarWorksheet(workbook, opcoes.aba || opcoes.nomeAba);

  const telefonesPorLinha = montarTelefonesPorLinhaOriginal(linhas);
  const colunaTelefone = obterColunaTelefoneEncontrado(worksheet);
  const header = worksheet.getRow(1);
  const headerCell = header.getCell(colunaTelefone);
  headerCell.value = 'Telefone encontrado';
  headerCell.font = { ...(headerCell.font || {}), bold: true };
  worksheet.getColumn(colunaTelefone).width = Math.max(18, worksheet.getColumn(colunaTelefone).width || 0);

  telefonesPorLinha.forEach((telefones, rowIndex) => {
    worksheet.getRow(rowIndex).getCell(colunaTelefone).value = telefones.join(' / ');
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const data = new Date().toISOString().slice(0, 10);
  const nomeOriginal = String(opcoes.nome || 'consulta-cnpj').replace(/\.xlsx$/i, '');
  const base = nomeArquivoSeguro(`${nomeOriginal}-telefones-${data}`);

  return {
    buffer,
    nome: `${base}.xlsx`
  };
}

async function gerarXlsxResultadoUpload(req) {
  const { arquivo, campos } = await lerArquivoMultipart(req);
  const linhas = parseJsonSeguro(campos.linhas, []);

  return gerarXlsxResultado(linhas, {
    nome: campos.nome || arquivo.filename,
    arquivoOriginal: arquivo.buffer,
    aba: campos.aba || campos.nomeAba || ''
  });
}
async function gerarXlsxResultado(linhas = [], opcoes = {}) {
  if (opcoes.arquivoOriginal) {
    return gerarXlsxOriginalComTelefones(linhas, opcoes);
  }

  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw criarHttpError(400, 'Nao ha resultados para exportar.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pos-venda';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Consulta CNPJ');
  worksheet.columns = COLUNAS_EXPORTACAO;

  linhas.forEach(linha => {
    worksheet.addRow(COLUNAS_EXPORTACAO.reduce((acc, coluna) => ({
      ...acc,
      [coluna.key]: valorExportacao(linha?.[coluna.key])
    }), {}));
  });

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle' };
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUNAS_EXPORTACAO.length }
  };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const data = new Date().toISOString().slice(0, 10);
  const base = nomeArquivoSeguro(opcoes.nome || `consulta-cnpj-${data}`);

  return {
    buffer,
    nome: `${base}.xlsx`
  };
}

module.exports = {
  adicionarLeads,
  adicionarGooglePlacesKey,
  atualizarGooglePlacesKey,
  consultarPlanilha,
  consultarPlanilhaStream,
  excluirBuscaRealizada,
  gerarXlsxResultado,
  gerarXlsxResultadoUpload,
  limparBuscasRealizadas,
  listarBuscasRealizadas,
  reconsultarBuscasRealizadas,
  listarGooglePlacesKeys,
  removerGooglePlacesKey,
  previewPlanilha
};









