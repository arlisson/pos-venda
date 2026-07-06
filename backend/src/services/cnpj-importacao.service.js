const Busboy = require('busboy');
const ExcelJS = require('exceljs');
const db = require('../database/connection');
const cnpjService = require('./cnpj.service');
const clienteSecretoService = require('./cliente-secreto.service');
const googlePlacesService = require('./google-places.service');

const INTERVALO_CONSULTA_MS = Number(process.env.CNPJ_IMPORT_INTERVALO_MS || 21000);
const LIMITE_LINHAS = Number(process.env.CNPJ_IMPORT_LIMITE_LINHAS || 50);
const TABELA_BUSCAS_REALIZADAS = 'cnpj_buscas_realizadas';
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

async function lerWorksheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw criarHttpError(400, 'A planilha nao possui abas.');
  return worksheet;
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
  const { arquivo } = await lerArquivoMultipart(req);
  const worksheet = await lerWorksheet(arquivo.buffer);
  const colunas = obterCabecalhos(worksheet);

  return {
    arquivo: arquivo.filename,
    aba: worksheet.name,
    total_linhas: Math.max(worksheet.rowCount - 1, 0),
    limite_linhas: LIMITE_LINHAS,
    colunas,
    sugestoes: {
      cnpj: sugerirColunaCnpj(colunas)
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

function extrairCnpjs(worksheet, colunaCnpj) {
  const colunas = obterCabecalhos(worksheet);
  const headerMap = new Map(colunas.map(coluna => [coluna.nome, coluna.index]));
  const colunaIndex = headerMap.get(colunaCnpj);
  if (!colunaIndex) throw criarHttpError(400, 'Selecione uma coluna de CNPJ valida.');

  const vistos = new Set();
  const linhas = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const cnpj = sanitizarCnpj(textoCelula(worksheet.getRow(rowIndex).getCell(colunaIndex).value));
    if (cnpj.length !== 14 || vistos.has(cnpj)) continue;
    vistos.add(cnpj);
    linhas.push({ row_index: rowIndex, cnpj });
  }

  if (linhas.length === 0) {
    throw criarHttpError(400, 'Nenhum CNPJ valido foi encontrado na coluna selecionada.');
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
  const worksheet = await lerWorksheet(arquivo.buffer);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const modoBuscaTelefone = ['sem_telefone', 'somente_google', 'nao'].includes(mapeamento.buscaTelefone)
    ? mapeamento.buscaTelefone
    : 'sem_telefone';

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna de CNPJ.');
  }

  const cnpjsTodos = extrairCnpjs(worksheet, mapeamento.cnpj);
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha CNPJs pendentes nesse lote.');
  }

  const linhas = [];
  const jaBuscados = [];
  let requisicoesExternas = 0;
  const proximoInicio = inicio + cnpjs.length;

  for (const [index, item] of cnpjs.entries()) {
    try {
      const registroJaBuscado = await buscarCnpjJaBuscado(item.cnpj);
      if (registroJaBuscado) {
        const linhaJaBuscada = montarLinhaJaBuscada(item, registroJaBuscado);
        linhas.push(linhaJaBuscada);
        jaBuscados.push(linhaJaBuscada);
        continue;
      }

      const dados = await enriquecerTelefoneFallback(await cnpjService.consultarCnpj(item.cnpj), modoBuscaTelefone);
      if (!dados.cache) requisicoesExternas += 1;
      const linha = montarLinhaConsulta(item, dados);
      linhas.push(linha);
      await salvarCnpjBuscado(linha);
      if (!dados.cache && index < cnpjs.length - 1) {
        await sleep(INTERVALO_CONSULTA_MS);
      }
    } catch (error) {
      linhas.push({
        row_index: item.row_index,
        status: 'erro',
        cnpj: formatarCnpj(item.cnpj),
        cnpj_digitos: item.cnpj,
        message: error.message || 'Erro ao consultar CNPJ.',
        code: error.code || 'erro',
        adicionado: false
      });
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
  const worksheet = await lerWorksheet(arquivo.buffer);
  const mapeamento = parseMapeamento(campos.mapeamento);
  const modoBuscaTelefone = ['sem_telefone', 'somente_google', 'nao'].includes(mapeamento.buscaTelefone)
    ? mapeamento.buscaTelefone
    : 'sem_telefone';

  if (!mapeamento.cnpj) {
    throw criarHttpError(400, 'Selecione a coluna de CNPJ.');
  }

  const cnpjsTodos = extrairCnpjs(worksheet, mapeamento.cnpj);
  const inicio = normalizarInteiroPositivo(mapeamento.inicio, 0);
  const limiteSolicitado = normalizarInteiroPositivo(mapeamento.limite, LIMITE_LINHAS);
  const limite = Math.min(Math.max(limiteSolicitado, 1), LIMITE_LINHAS);
  const cnpjs = cnpjsTodos.slice(inicio, inicio + limite);

  if (cnpjs.length === 0) {
    throw criarHttpError(400, 'Nao ha CNPJs pendentes nesse lote.');
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

  await onEvento({ tipo: 'inicio', ...meta });

  for (const [index, item] of cnpjs.entries()) {
    await onEvento({
      tipo: 'progresso',
      atual: index + 1,
      total_lote: cnpjs.length,
      cnpj: formatarCnpj(item.cnpj),
      cnpj_digitos: item.cnpj
    });

    try {
      const registroJaBuscado = await buscarCnpjJaBuscado(item.cnpj);
      if (registroJaBuscado) {
        const linhaJaBuscada = montarLinhaJaBuscada(item, registroJaBuscado);
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
      const linha = montarLinhaConsulta(item, dados);
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
      await onEvento({
        tipo: 'linha',
        linha: {
          row_index: item.row_index,
          status: 'erro',
          cnpj: formatarCnpj(item.cnpj),
          cnpj_digitos: item.cnpj,
          message: error.message || 'Erro ao consultar CNPJ.',
          code: error.code || 'erro',
          adicionado: false
        },
        requisicoes_externas: requisicoesExternas
      });

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

  for (const linha of linhas) {
    const cnpj = sanitizarCnpj(linha?.cnpj_digitos || linha?.cnpj);
    if (cnpj.length !== 14 || vistos.has(cnpj)) {
      resultado.ignorados += 1;
      continue;
    }
    vistos.add(cnpj);

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

async function gerarXlsxResultado(linhas = [], opcoes = {}) {
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
  gerarXlsxResultado,
  listarGooglePlacesKeys,
  removerGooglePlacesKey,
  previewPlanilha
};
