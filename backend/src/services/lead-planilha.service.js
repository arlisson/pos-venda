const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');
/**
 * Servico de importacao, distribuicao e acompanhamento de planilhas de leads.
 */
const LeadPlanilha = require('../models/LeadPlanilha');
const LeadLinha = require('../models/LeadLinha');
const LeadEnvio = require('../models/LeadEnvio');
const LeadEnvioUsuario = require('../models/LeadEnvioUsuario');
const db = require('../database/connection');
const { parseUtcDateTime } = require('../utils/datetime');

const IMPORT_DIR = process.env.LEAD_IMPORT_DIR
  ? path.resolve(process.env.LEAD_IMPORT_DIR)
  : path.resolve(__dirname, '../../storage/lead-imports');
const INSERT_BATCH_SIZE = 1000;
const INSERT_BATCH_MAX_BYTES = Number(process.env.LEAD_IMPORT_BATCH_MAX_BYTES || 350000);
const SINGLE_ROW_MAX_BYTES = Number(process.env.LEAD_IMPORT_ROW_MAX_BYTES || 300000);
const SELECT_BATCH_SIZE = 2000;
const DB_RETRY_ATTEMPTS = 2;
const USAR_LOAD_INFILE = process.env.LEAD_IMPORT_USE_LOAD_INFILE === 'true';
const UPDATED_COLUMN_SUFFIX = ' (atualizado)';

const TRANSIENT_DB_ERRORS = [
  'closed state',
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'Cannot enqueue',
  'Connection lost',
  'Lock wait timeout exceeded',
  'Deadlock found'
];

/**
 * Executa a rotina sleep.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa a rotina is transient db error.
 */
function isTransientDbError(error) {
  const texto = [
    error?.message,
    error?.code,
    error?.errno,
    error?.sqlState
  ].filter(Boolean).join(' ');

  return TRANSIENT_DB_ERRORS.some(pattern => texto.includes(pattern));
}

/**
 * Executa a rotina log processamento.
 */
function logProcessamento(planilhaId, etapa, dados = {}) {
  const partes = [`[lead-planilhas] planilha_id=${planilhaId}`, `etapa=${etapa}`];
  if (dados.linhas !== undefined) partes.push(`linhas=${dados.linhas}`);
  if (dados.bytes !== undefined) partes.push(`bytes=${dados.bytes}`);
  if (dados.arquivo) partes.push(`arquivo=${dados.arquivo}`);
  if (dados.tentativa !== undefined) partes.push(`tentativa=${dados.tentativa}`);

  const erro = dados.error;
  if (erro) {
    console.error(`${partes.join(' ')} erro=${erro.message || erro}`, {
      code: erro.code,
      errno: erro.errno,
      sqlState: erro.sqlState,
      stack: erro.stack
    });
    return;
  }

  console.log(partes.join(' '));
}

/**
 * Executa a rotina remover arquivo importacao.
 */
async function removerArquivoImportacao(planilhaId, arquivoPath, contexto) {
  if (!arquivoPath) return true;

  try {
    await fs.promises.unlink(arquivoPath);
    logProcessamento(planilhaId, `arquivo_removido.${contexto}`, { arquivo: arquivoPath });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }

    if (error.code !== 'ENOENT') {
      logProcessamento(planilhaId, `arquivo_removido.${contexto}.erro`, { arquivo: arquivoPath, error });
    }
    return false;
  }
}

/**
 * Executa a rotina with db retry.
 */
async function withDbRetry(planilhaId, etapa, fn, opcoes = {}) {
  const tentativas = opcoes.tentativas ?? DB_RETRY_ATTEMPTS;

  for (let tentativa = 0; tentativa <= tentativas; tentativa += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error?.code === 'ER_NET_PACKET_TOO_LARGE') {
        throw new Error('Um lote ou linha excedeu o max_allowed_packet do MySQL. Reduza LEAD_IMPORT_BATCH_MAX_BYTES/LEAD_IMPORT_ROW_MAX_BYTES ou aumente max_allowed_packet no MySQL.');
      }

      const podeTentarNovamente = tentativa < tentativas && isTransientDbError(error);
      logProcessamento(planilhaId, etapa, {
        linhas: opcoes.linhas,
        tentativa: tentativa + 1,
        error
      });

      if (!podeTentarNovamente) throw error;
      await sleep(300 * (tentativa + 1));
    }
  }

  return null;
}

/**
 * Executa a rotina inserir lead linhas.
 */
async function inserirLeadLinhas(planilhaId, linhas, etapa) {
  if (!linhas.length) return;

  if (USAR_LOAD_INFILE) {
    return inserirViaLoadInfile(planilhaId, linhas, etapa);
  }

  let lote = [];
  let loteBytes = 0;

  /**
   * Executa a rotina flush.
   */
  async function flush() {
    if (lote.length === 0) return;
    const loteAtual = lote;
    lote = [];
    loteBytes = 0;

    await withDbRetry(
      planilhaId,
      `${etapa}.insert`,
      () => LeadLinha.knex()('lead_linhas').insert(loteAtual),
      { linhas: loteAtual.length }
    );
  }

  for (const linha of linhas) {
    const tamanhoLinha = Buffer.byteLength(String(linha.dados_json || ''), 'utf8') + 256;

    if (tamanhoLinha > SINGLE_ROW_MAX_BYTES) {
      throw new Error(`Linha ${linha.row_index ?? '?'} excede o limite seguro de importacao (${tamanhoLinha} bytes). Revise a planilha ou aumente LEAD_IMPORT_ROW_MAX_BYTES.`);
    }

    if (lote.length > 0 && (lote.length >= INSERT_BATCH_SIZE || loteBytes + tamanhoLinha > INSERT_BATCH_MAX_BYTES)) {
      await flush();
    }

    lote.push(linha);
    loteBytes += tamanhoLinha;
  }

  await flush();
}

/**
 * Executa a rotina escape load infile value.
 */
function escapeLoadInfileValue(valor) {
  return String(valor)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Executa a rotina inserir via load infile.
 */
async function inserirViaLoadInfile(planilhaId, linhas, etapa) {
  const tmpDir = os.tmpdir();
  const arquivoTsv = path.join(tmpDir, `lead-load-${planilhaId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tsv`);

  let escritas = 0;
  const stream = fs.createWriteStream(arquivoTsv, { encoding: 'utf8' });
  try {
    for (const linha of linhas) {
      const dadosJson = String(linha.dados_json || '');
      const tamanhoLinha = Buffer.byteLength(dadosJson, 'utf8') + 256;
      if (tamanhoLinha > SINGLE_ROW_MAX_BYTES) {
        throw new Error(`Linha ${linha.row_index ?? '?'} excede o limite seguro de importacao (${tamanhoLinha} bytes).`);
      }

      const fileLine = `${linha.planilha_id}\t${linha.row_index}\t${escapeLoadInfileValue(dadosJson)}\n`;
      if (!stream.write(fileLine)) {
        await new Promise(resolve => stream.once('drain', resolve));
      }
      escritas += 1;
    }
    await new Promise((resolve, reject) => {
      stream.end(err => (err ? reject(err) : resolve()));
    });

    const sql = `LOAD DATA LOCAL INFILE ? INTO TABLE lead_linhas
      CHARACTER SET utf8mb4
      FIELDS TERMINATED BY '\\t' ESCAPED BY '\\\\'
      LINES TERMINATED BY '\\n'
      (planilha_id, row_index, dados_json)`;

    await withDbRetry(
      planilhaId,
      `${etapa}.load_infile`,
      () => LeadLinha.knex().raw(sql, [arquivoTsv]),
      { linhas: escritas }
    );
  } finally {
    fs.promises.unlink(arquivoTsv).catch(() => {});
  }
}

/**
 * Executa a rotina criar http error.
 */
function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Executa a rotina formatar date time sql.
 */
function formatarDateTimeSQL(data = new Date()) {
  /**
   * Executa a rotina pad.
   */
  const pad = value => String(value).padStart(2, '0');

  return [
    data.getUTCFullYear(),
    pad(data.getUTCMonth() + 1),
    pad(data.getUTCDate())
  ].join('-') + ' ' + [
    pad(data.getUTCHours()),
    pad(data.getUTCMinutes()),
    pad(data.getUTCSeconds())
  ].join(':');
}

/**
 * Executa a rotina parse data hora retorno.
 */
function parseDataHoraRetorno(valor) {
  if (!valor) return null;

  const data = new Date(String(valor).trim().replace(' ', 'T'));

  if (Number.isNaN(data.getTime())) {
    throw criarHttpError(400, 'Data de retorno invalida.');
  }

  return formatarDateTimeSQL(data);
}

/**
 * Executa a rotina adicionar dias.
 */
function adicionarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/**
 * Executa a rotina aplicar busca futuros clientes.
 */
function aplicarBuscaFuturosClientes(query, busca) {
  const termo = String(busca || '').trim().toLowerCase();
  if (!termo) return query;

  return query.where(builder => {
    builder
      .whereRaw('LOWER(dados_json) LIKE ?', [`%${termo}%`])
      .orWhereRaw('LOWER(COALESCE(futuro_cliente_notas, "")) LIKE ?', [`%${termo}%`]);
  });
}

/**
 * Executa a rotina parse json.
 */
function parseJson(valor, fallback) {
  if (valor === null || valor === undefined) return fallback;
  if (typeof valor !== 'string') return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
}

/**
 * Executa a rotina formatar planilha.
 */
function formatarPlanilha(planilha) {
  const json = typeof planilha?.toJSON === 'function' ? planilha.toJSON() : planilha;
  if (!json) return json;

  return {
    ...json,
    colunas: parseJson(json.colunas, []),
    schema_colunas: parseJson(json.schema_colunas, {}),
    total_linhas: Number(json.total_linhas || 0),
    linhas_processadas: Number(json.linhas_processadas || json.total_linhas || 0),
    progresso_percentual: Number(json.progresso_percentual ?? 100),
    tamanho_bytes: Number(json.tamanho_bytes || 0)
  };
}

const PROCESSAMENTO_TRAVADO_MS = Number(process.env.LEAD_IMPORT_STALE_MS || 5 * 60 * 1000);

/**
 * Executa a rotina reconciliar planilha processando.
 */
async function reconciliarPlanilhaProcessando(planilha) {
  const json = typeof planilha?.toJSON === 'function' ? planilha.toJSON() : planilha;
  if (!json || json.status !== 'processando') return planilha;

  const arquivoSumiu = json.arquivo_temporario && !fs.existsSync(json.arquivo_temporario);
  const semProgresso = Number(json.linhas_processadas || 0) === 0 && Number(json.progresso_percentual || 0) === 0;

  const ultimaAtualizacao = parseUtcDateTime(json.updated_at || json.created_at)?.getTime() ?? NaN;
  const tempoOcioso = Date.now() - ultimaAtualizacao;
  const travado = Number.isFinite(ultimaAtualizacao) && tempoOcioso > PROCESSAMENTO_TRAVADO_MS;

  let motivo = null;
  if (arquivoSumiu && semProgresso) {
    motivo = 'Arquivo temporário não encontrado; o processamento pode ter sido interrompido por reinício do servidor ou falha antes de registrar o erro.';
  } else if (travado) {
    motivo = `Processamento sem atualização há ${Math.round(tempoOcioso / 1000)}s; provavelmente o processo foi encerrado (reinicio do servidor, falta de memoria ou falha silenciosa).`;
  }

  if (!motivo) return planilha;

  try {
    const patch = {
      status: 'erro',
      erro_processamento: motivo,
      updated_at: new Date()
    };
    if (arquivoSumiu) patch.arquivo_temporario = null;

    const atualizada = await withDbRetry(json.id, 'reconciliarProcessamento', () => (
      LeadPlanilha.query().patchAndFetchById(json.id, patch)
    ));
    return atualizada || planilha;
  } catch (error) {
    logProcessamento(json.id, 'reconciliarProcessamento.erro', { error });
    return planilha;
  }
}

/**
 * Executa a rotina formatar envio.
 */
function formatarEnvio(envio) {
  const json = typeof envio?.toJSON === 'function' ? envio.toJSON() : envio;
  if (!json) return json;

  return {
    ...json,
    colunas_visiveis: parseJson(json.colunas_visiveis, []),
    usuarios: (json.usuarios || []).map(item => ({
      ...item,
      usuario: item.usuario
    }))
  };
}

/**
 * Executa a rotina formatar linha.
 */
function formatarLinha(linha) {
  const json = typeof linha?.toJSON === 'function' ? linha.toJSON() : linha;
  if (!json) return json;

  return {
    ...json,
    dados_json: parseJson(json.dados_json, {}),
    planilha: formatarPlanilha(json.planilha),
    envio: formatarEnvio(json.envio)
  };
}

/**
 * Executa a rotina listar planilhas.
 */
async function listarPlanilhas() {
  const planilhas = await LeadPlanilha.query()
    .withGraphFetched('criador')
    .modifyGraph('criador', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  const reconciliadas = [];
  for (const planilha of planilhas) {
    reconciliadas.push(await reconciliarPlanilhaProcessando(planilha));
  }

  return reconciliadas.map(formatarPlanilha);
}

/**
 * Executa a rotina buscar status.
 */
async function buscarStatus(planilhaId) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);
  return formatarPlanilha(await reconciliarPlanilhaProcessando(planilha));
}

/**
 * Executa a rotina criar planilha.
 */
async function criarPlanilha(dados, usuarioId) {
  const colunas = Array.isArray(dados.colunas) ? dados.colunas : [];
  const schemaColunas = dados.schema_colunas && typeof dados.schema_colunas === 'object'
    ? dados.schema_colunas
    : {};

  if (!String(dados.nome || '').trim()) {
    throw new Error('Informe o nome da planilha.');
  }

  const modoStreaming = dados.streaming === true;
  const status = modoStreaming ? 'processando' : 'concluida';
  const totalInicial = Number(dados.total_linhas || 0);

  const planilha = await LeadPlanilha.query().insertAndFetch({
    nome: String(dados.nome).trim(),
    colunas: JSON.stringify(colunas),
    schema_colunas: JSON.stringify(schemaColunas),
    total_linhas: totalInicial,
    linhas_processadas: totalInicial,
    progresso_percentual: modoStreaming ? 0 : 100,
    status,
    criado_por_id: usuarioId
  });

  return formatarPlanilha(planilha);
}

/**
 * Executa a rotina salvar linhas lote.
 */
async function salvarLinhasLote(planilhaId, linhas = []) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);
  if (!planilha) throw new Error('Planilha não encontrada.');

  const payload = linhas.map((linha, index) => ({
    planilha_id: Number(planilhaId),
    row_index: Number(linha.row_index ?? index),
    dados_json: JSON.stringify(linha.dados_json || linha.dados || {})
  }));

  if (payload.length > 0) {
    await inserirLeadLinhas(planilhaId, payload, 'salvarLinhasLote');
  }

  const total = Number(planilha.total_linhas || 0) + payload.length;
  const ehStreaming = planilha.status === 'processando';

  const patch = {
    total_linhas: total,
    linhas_processadas: total,
    updated_at: new Date()
  };
  if (!ehStreaming) {
    patch.progresso_percentual = 100;
    patch.status = 'concluida';
  }

  await withDbRetry(planilhaId, 'salvarLinhasLote.progresso', () => (
    LeadPlanilha.query().patchAndFetchById(planilhaId, patch)
  ));

  return { total_linhas: total };
}

/**
 * Executa a rotina finalizar planilha.
 */
async function finalizarPlanilha(planilhaId, dados = {}) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);
  if (!planilha) throw criarHttpError(404, 'Planilha não encontrada.');

  const colunas = Array.isArray(dados.colunas) ? dados.colunas : null;
  const schemaColunas = dados.schema_colunas && typeof dados.schema_colunas === 'object'
    ? dados.schema_colunas
    : null;

  const patch = {
    status: 'concluida',
    progresso_percentual: 100,
    arquivo_temporario: null,
    erro_processamento: null,
    updated_at: new Date()
  };
  if (colunas) patch.colunas = JSON.stringify(colunas);
  if (schemaColunas) patch.schema_colunas = JSON.stringify(schemaColunas);

  const atualizada = await withDbRetry(planilhaId, 'finalizarPlanilha', () => (
    LeadPlanilha.query().patchAndFetchById(planilhaId, patch)
  ));
  return formatarPlanilha(atualizada || planilha);
}

/**
 * Executa a rotina marcar erro planilha.
 */
async function marcarErroPlanilha(planilhaId, mensagem) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);
  if (!planilha) throw criarHttpError(404, 'Planilha não encontrada.');

  const atualizada = await withDbRetry(planilhaId, 'marcarErroPlanilha', () => (
    LeadPlanilha.query().patchAndFetchById(planilhaId, {
      status: 'erro',
      erro_processamento: String(mensagem || 'Erro reportado pelo cliente.').slice(0, 1000),
      updated_at: new Date()
    })
  ));
  return formatarPlanilha(atualizada || planilha);
}

/**
 * Executa a rotina atualizar schema.
 */
async function atualizarSchema(planilhaId, schemaColunas) {
  const planilha = await LeadPlanilha.query().patchAndFetchById(planilhaId, {
    schema_colunas: JSON.stringify(schemaColunas || {}),
    updated_at: new Date()
  });

  return planilha ? formatarPlanilha(planilha) : null;
}

/**
 * Executa a rotina excluir planilha.
 */
async function excluirPlanilha(planilhaId) {
  let planilha = await LeadPlanilha.query().findById(planilhaId);

  if (!planilha) {
    throw criarHttpError(404, 'Planilha não encontrada.');
  }

  if (planilha.status === 'processando') {
    planilha = await reconciliarPlanilhaProcessando(planilha);

    if (planilha.status === 'processando') {
      throw criarHttpError(409, 'Aguarde o processamento terminar antes de excluir esta planilha.');
    }
  }

  const enviosAfetados = await LeadLinha.query()
    .distinct('envio_id')
    .where('planilha_id', planilhaId)
    .whereNotNull('envio_id');

  await withDbRetry(planilhaId, 'excluirPlanilha.delete', () => (
    LeadPlanilha.query().deleteById(planilhaId)
  ));

  const envioIds = enviosAfetados.map(item => item.envio_id).filter(Boolean);
  for (const envioId of envioIds) {
    const linhasRestantes = await LeadLinha.query()
      .where('envio_id', envioId)
      .resultSize();

    if (linhasRestantes === 0) {
      await withDbRetry(planilhaId, 'excluirPlanilha.envio_orfao', () => (
        LeadEnvio.query().deleteById(envioId)
      ));
    }
  }

  if (planilha.arquivo_temporario) {
    removerArquivoImportacao(planilhaId, planilha.arquivo_temporario, 'exclusao').catch(() => {});
  }

  return true;
}

/**
 * Executa a rotina ids from query.
 */
function idsFromQuery(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map(Number).filter(Boolean);
  return String(valor)
    .split(',')
    .map(item => Number(item.trim()))
    .filter(Boolean);
}

/**
 * Executa a rotina get json value expr.
 */
function getJsonValueExpr(coluna) {
  const pathSeguro = String(coluna || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `JSON_UNQUOTE(JSON_EXTRACT(dados_json, '$."${pathSeguro}"'))`;
}

/**
 * Executa a rotina get coluna nome.
 */
function getColunaNome(coluna) {
  return coluna?.nome || coluna?.label || coluna;
}

/**
 * Executa a rotina criar coluna atualizada.
 */
function criarColunaAtualizada(coluna) {
  if (typeof coluna === 'string') return `${coluna}${UPDATED_COLUMN_SUFFIX}`;

  const nome = coluna.nome || coluna.label || '';
  const label = coluna.label || nome;

  return {
    ...coluna,
    id: `${coluna.id || nome}::updated`,
    nome: `${nome}${UPDATED_COLUMN_SUFFIX}`,
    label: `${label}${UPDATED_COLUMN_SUFFIX}`,
    sources: Array.isArray(coluna.sources)
      ? coluna.sources.map(source => ({
        ...source,
        nome: `${source.nome}${UPDATED_COLUMN_SUFFIX}`
      }))
      : coluna.sources
  };
}

/**
 * Executa a rotina coluna atualizada existe.
 */
function colunaAtualizadaExiste(coluna, chavesAtualizadas) {
  if (!coluna || String(getColunaNome(coluna)).endsWith(UPDATED_COLUMN_SUFFIX)) return false;

  if (Array.isArray(coluna.sources) && coluna.sources.length > 0) {
    return coluna.sources.some(source => chavesAtualizadas.has(`${source.nome}${UPDATED_COLUMN_SUFFIX}`));
  }

  return chavesAtualizadas.has(`${getColunaNome(coluna)}${UPDATED_COLUMN_SUFFIX}`);
}

/**
 * Executa a rotina coletar chaves atualizadas.
 */
async function coletarChavesAtualizadas(query) {
  const chaves = new Set();
  let offset = 0;

  while (true) {
    const linhas = await query.clone()
      .select('dados_json')
      .orderBy('planilha_id', 'asc')
      .orderBy('row_index', 'asc')
      .offset(offset)
      .limit(SELECT_BATCH_SIZE);
    if (linhas.length === 0) break;

    linhas.forEach(linha => {
      Object.keys(parseJson(linha.dados_json, {}))
        .filter(chave => chave.endsWith(UPDATED_COLUMN_SUFFIX))
        .forEach(chave => chaves.add(chave));
    });

    offset += linhas.length;
  }

  return chaves;
}

/**
 * Executa a rotina expandir colunas exportacao.
 */
async function expandirColunasExportacao(colunas, query) {
  const chavesAtualizadas = await coletarChavesAtualizadas(query);
  if (chavesAtualizadas.size === 0) return colunas;

  const resultado = [];
  const incluidas = new Set();

  colunas.forEach(coluna => {
    const nome = getColunaNome(coluna);
    if (!incluidas.has(nome)) {
      resultado.push(coluna);
      incluidas.add(nome);
    }

    const nomeAtualizado = `${nome}${UPDATED_COLUMN_SUFFIX}`;
    if (!String(nome).endsWith(UPDATED_COLUMN_SUFFIX) && colunaAtualizadaExiste(coluna, chavesAtualizadas) && !incluidas.has(nomeAtualizado)) {
      resultado.push(criarColunaAtualizada(coluna));
      incluidas.add(nomeAtualizado);
    }
  });

  return resultado;
}

/**
 * Executa a rotina aplicar filtros query.
 */
function aplicarFiltrosQuery(query, filtros = {}, opcoes = {}) {
  const planilhaIds = idsFromQuery(filtros.planilha_ids);
  const envioIds = idsFromQuery(filtros.envio_ids);

  if (planilhaIds.length > 0) query.whereIn('planilha_id', planilhaIds);
  if (envioIds.length > 0) query.whereIn('envio_id', envioIds);
  if (opcoes.usuarioId) query.where('atribuido_para_id', Number(opcoes.usuarioId));

  if (filtros.busca) {
    query.whereRaw('LOWER(CAST(dados_json AS CHAR)) LIKE ?', [`%${String(filtros.busca).toLowerCase()}%`]);
  }

  const filtrosColuna = parseJson(filtros.filters, Array.isArray(filtros.filters) ? filtros.filters : []);
  filtrosColuna.forEach(filtro => {
    if (!filtro?.coluna || (!filtro.valor && filtro.op !== 'between')) return;
    const expr = getJsonValueExpr(filtro.coluna);
    const valor = String(filtro.valor || '');

    if (filtro.planilha_id) {
      query.where('planilha_id', Number(filtro.planilha_id));
    }

    if (filtro.tipo === 'date') {
      if (filtro.op === 'between') {
        if (filtro.valor) query.whereRaw(`${expr} >= ?`, [filtro.valor]);
        if (filtro.valor2) query.whereRaw(`${expr} <= ?`, [filtro.valor2]);
      } else {
        query.whereRaw(`${expr} = ?`, [valor]);
      }
      return;
    }

    if (filtro.op === 'exact') query.whereRaw(`${expr} = ?`, [valor]);
    else if (filtro.op === 'starts') query.whereRaw(`${expr} LIKE ?`, [`${valor}%`]);
    else if (filtro.op === 'ends') query.whereRaw(`${expr} LIKE ?`, [`%${valor}`]);
    else query.whereRaw(`${expr} LIKE ?`, [`%${valor}%`]);
  });
}

/**
 * Executa a rotina listar linhas.
 */
async function listarLinhas(filtros = {}, opcoes = {}) {
  const page = Math.max(1, Number(filtros.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(filtros.page_size || filtros.pageSize || 200)));
  const baseQuery = LeadLinha.query();
  aplicarFiltrosQuery(baseQuery, filtros, opcoes);

  const total = await baseQuery.clone().resultSize();
  const enviados = await baseQuery.clone()
    .where(builder => {
      builder.whereNotNull('envio_id').orWhereNotNull('atribuido_para_id');
    })
    .resultSize();
  const linhas = await baseQuery
    .withGraphFetched('[planilha, envio, atribuidoPara]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'))
    .orderBy('planilha_id', 'asc')
    .orderBy('row_index', 'asc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return {
    data: linhas.map(formatarLinha),
    total,
    resumo: {
      total,
      enviados,
      nao_enviados: Math.max(0, total - enviados)
    },
    page,
    page_size: pageSize
  };
}

/**
 * Executa a rotina atualizar campo linha recebida.
 */
async function atualizarCampoLinhaRecebida(linhaId, usuarioId, dados = {}) {
  const linha = await LeadLinha.query().findById(linhaId);
  if (!linha) throw criarHttpError(404, 'Lead não encontrado.');

  if (Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Você não pode atualizar este lead.');
  }

  const coluna = String(dados.coluna || '').trim();
  const valor = String(dados.valor || '').trim();
  if (!coluna) throw criarHttpError(400, 'Informe a coluna que sera atualizada.');
  if (coluna.endsWith(UPDATED_COLUMN_SUFFIX)) throw criarHttpError(400, 'Atualize a coluna original, não a coluna atualizada.');
  if (!valor) throw criarHttpError(400, 'Informe a informacao atualizada.');

  const dadosJson = parseJson(linha.dados_json, {});
  if (!Object.prototype.hasOwnProperty.call(dadosJson, coluna)) {
    throw criarHttpError(400, 'Coluna não encontrada neste lead.');
  }

  const colunaAtualizada = `${coluna}${UPDATED_COLUMN_SUFFIX}`;
  dadosJson[colunaAtualizada] = valor;

  await LeadLinha.query().patchAndFetchById(linha.id, {
    dados_json: JSON.stringify(dadosJson)
  });
  const atualizada = await LeadLinha.query()
    .findById(linha.id)
    .withGraphFetched('[planilha, envio, atribuidoPara]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'));

  return {
    linha: formatarLinha(atualizada),
    coluna,
    coluna_atualizada: colunaAtualizada,
    valor
  };
}

/**
 * Executa a rotina listar envios do usuario.
 */
async function listarEnviosDoUsuario(usuarioId) {
  const envios = await LeadEnvio.query()
    .whereExists(
      LeadEnvioUsuario.query()
        .select(1)
        .whereRaw('lead_envio_usuarios.envio_id = lead_envios.id')
        .where('lead_envio_usuarios.usuario_id', usuarioId)
    )
    .withGraphFetched('usuarios.usuario')
    .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  return envios.map(formatarEnvio);
}

/**
 * Executa a rotina listar todos envios.
 */
async function listarTodosEnvios() {
  const envios = await LeadEnvio.query()
    .withGraphFetched('usuarios.usuario')
    .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  return envios.map(formatarEnvio);
}

/**
 * Executa a rotina montar alocacoes.
 */
function montarAlocacoes(usuarioIds, quantidadeTotal, alocacaoManual = {}) {
  const base = Math.floor(quantidadeTotal / usuarioIds.length);
  const sobra = quantidadeTotal % usuarioIds.length;

  if (sobra > 0) {
    const totalManual = Object.values(alocacaoManual)
      .reduce((acc, valor) => acc + Number(valor || 0), 0);
    if (totalManual !== sobra) {
      return {
        pendente: true,
        sobra,
        base,
        alocacoes: usuarioIds.reduce((acc, id) => ({ ...acc, [id]: base }), {})
      };
    }
  }

  return {
    pendente: false,
    sobra,
    base,
    alocacoes: usuarioIds.reduce((acc, id) => ({
      ...acc,
      [id]: base + Number(alocacaoManual[id] || 0)
    }), {})
  };
}

/**
 * Executa a rotina buscar ids por criterios.
 */
async function buscarIdsPorCriterios(dados, quantidadeTotal) {
  if (Array.isArray(dados.linha_ids) && dados.linha_ids.length > 0) {
    return dados.linha_ids.map(Number).filter(Boolean).slice(0, quantidadeTotal);
  }

  const incluirEnviados = dados.incluir_enviados === true;
  const query = LeadLinha.query().select('id');
  aplicarFiltrosQuery(query, dados.filtros || {});

  if (!incluirEnviados) {
    query.whereNull('envio_id');
  }

  const rows = await query
    .orderBy('planilha_id', 'asc')
    .orderBy('row_index', 'asc')
    .limit(quantidadeTotal);
  return rows.map(row => row.id);
}

/**
 * Executa a rotina dividir leads.
 */
async function dividirLeads(dados, usuarioId) {
  const usuarioIds = Array.isArray(dados.usuario_ids)
    ? dados.usuario_ids.map(Number).filter(Boolean)
    : [];
  const quantidadeTotal = Number(dados.quantidade_total || 0);

  if (!String(dados.nome || '').trim()) throw new Error('Informe um nome para o envio.');
  if (usuarioIds.length === 0) throw new Error('Selecione ao menos um vendedor.');
  if (quantidadeTotal <= 0) throw new Error('Quantidade de clientes invalida.');

  const linhaIds = await buscarIdsPorCriterios(dados, quantidadeTotal);
  if (linhaIds.length < quantidadeTotal) {
    if (dados.incluir_enviados === true) {
      throw new Error('Não há mailing suficiente para a quantidade solicitada.');
    }
    throw new Error('Não há mailing não enviado suficiente. Ative incluir mailing já enviado para transferir linhas distribuídas.');
  }

  const totalJaEnviados = dados.incluir_enviados === true
    ? await LeadLinha.query()
      .whereIn('id', linhaIds)
      .where(builder => {
        builder.whereNotNull('envio_id').orWhereNotNull('atribuido_para_id');
      })
      .resultSize()
    : 0;

  const alocacao = montarAlocacoes(usuarioIds, quantidadeTotal, dados.alocacao_manual || {});
  if (alocacao.pendente) {
    return {
      requires_manual_allocation: true,
      sobra: alocacao.sobra,
      base: alocacao.base,
      alocacoes: alocacao.alocacoes
    };
  }

  return LeadEnvio.transaction(async trx => {
    const envio = await LeadEnvio.query(trx).insertAndFetch({
      nome: String(dados.nome).trim(),
      total_linhas: quantidadeTotal,
      colunas_visiveis: JSON.stringify(dados.colunas_visiveis || []),
      criado_por_id: usuarioId
    });

    let cursor = 0;
    for (const usuarioAlvoId of usuarioIds) {
      const quantidade = Number(alocacao.alocacoes[usuarioAlvoId] || 0);
      const idsUsuario = linhaIds.slice(cursor, cursor + quantidade);
      cursor += quantidade;

      await LeadEnvioUsuario.query(trx).insert({
        envio_id: envio.id,
        usuario_id: usuarioAlvoId,
        quantidade
      });

      for (let i = 0; i < idsUsuario.length; i += SELECT_BATCH_SIZE) {
        await LeadLinha.query(trx)
          .whereIn('id', idsUsuario.slice(i, i + SELECT_BATCH_SIZE))
          .patch({
            atribuido_para_id: usuarioAlvoId,
            envio_id: envio.id,
            updated_at: new Date()
          });
      }
    }

    const envioCompleto = await LeadEnvio.query(trx)
      .findById(envio.id)
      .withGraphFetched('usuarios.usuario')
      .modifyGraph('usuarios.usuario', builder => builder.select('id', 'nome', 'email'));

    return {
      requires_manual_allocation: false,
      total_reenviados: totalJaEnviados,
      envio: formatarEnvio(envioCompleto)
    };
  });
}

/**
 * Executa a rotina processar removido ini.
 */
async function __PROCESSAR_REMOVIDO_INI__(planilhaId, arquivoPath, tamanhoBytes) {
  let colunas = null;
  let delimitador = ';';
  let sobra = '';
  let rowIndex = 0;
  let bytesLidos = 0;
  let ultimoProgresso = -1;
  let lote = [];
  let loteBytes = 0;
  const amostra = [];

  /**
   * Executa a rotina atualizar progresso por bytes.
   */
  async function atualizarProgressoPorBytes() {
    if (tamanhoBytes <= 0) return;
    const progresso = Math.min(99, Math.floor((bytesLidos / tamanhoBytes) * 100));
    if (progresso <= ultimoProgresso) return;
    ultimoProgresso = progresso;
    await atualizarProgresso(planilhaId, {
      linhas_processadas: rowIndex,
      total_linhas: rowIndex,
      progresso_percentual: progresso
    });
  }

  /**
   * Executa a rotina flush.
   */
  async function flush() {
    if (lote.length === 0) return;
    await inserirLeadLinhas(planilhaId, lote, 'processarArquivoCsv');
    rowIndex += lote.length;
    lote = [];
    loteBytes = 0;
    const progresso = tamanhoBytes > 0 ? Math.min(99, Math.floor((bytesLidos / tamanhoBytes) * 100)) : 0;
    ultimoProgresso = Math.max(ultimoProgresso, progresso);
    await atualizarProgresso(planilhaId, {
      linhas_processadas: rowIndex,
      total_linhas: rowIndex,
      progresso_percentual: progresso
    });
  }

  try {
    logProcessamento(planilhaId, 'inicio', { linhas: 0, bytes: tamanhoBytes, arquivo: arquivoPath });
    const stream = fs.createReadStream(arquivoPath, { encoding: 'utf8', highWaterMark: 1024 * 1024 });

    for await (const chunk of stream) {
      bytesLidos += Buffer.byteLength(chunk, 'utf8');
      await atualizarProgressoPorBytes();
      const partes = (sobra + chunk).split(/\r?\n/);
      sobra = partes.pop() || '';

      for (const linha of partes) {
        if (!linha.trim()) continue;
        if (!colunas) {
          delimitador = detectarDelimitador(linha.replace(/^\uFEFF/, ''));
          colunas = normalizarColunasDuplicadas(parseCsvLine(linha.replace(/^\uFEFF/, ''), delimitador));
          await atualizarProgresso(planilhaId, { colunas: JSON.stringify(colunas) });
          continue;
        }

        const valores = parseCsvLine(linha, delimitador);
        const dados = {};
        colunas.forEach((coluna, index) => {
          dados[coluna] = valores[index] ?? '';
        });

        if (amostra.length < 200) amostra.push(dados);
        const dadosJson = JSON.stringify(dados);
        lote.push({
          planilha_id: Number(planilhaId),
          row_index: rowIndex + lote.length,
          dados_json: dadosJson
        });
        loteBytes += Buffer.byteLength(dadosJson, 'utf8') + 256;

        if (lote.length >= INSERT_BATCH_SIZE || loteBytes >= INSERT_BATCH_MAX_BYTES) await flush();
      }
    }

    if (sobra.trim()) {
      if (!colunas) {
        delimitador = detectarDelimitador(sobra.replace(/^\uFEFF/, ''));
        colunas = normalizarColunasDuplicadas(parseCsvLine(sobra.replace(/^\uFEFF/, ''), delimitador));
      } else {
        const valores = parseCsvLine(sobra, delimitador);
        const dados = {};
        colunas.forEach((coluna, index) => {
          dados[coluna] = valores[index] ?? '';
        });
        if (amostra.length < 200) amostra.push(dados);
        const dadosJson = JSON.stringify(dados);
        lote.push({
          planilha_id: Number(planilhaId),
          row_index: rowIndex + lote.length,
          dados_json: dadosJson
        });
        loteBytes += Buffer.byteLength(dadosJson, 'utf8') + 256;
      }
    }

    await flush();

    if (!colunas || colunas.length === 0) {
      throw new Error('CSV sem cabeçalho válido.');
    }

    await atualizarProgresso(planilhaId, {
      colunas: JSON.stringify(colunas),
      schema_colunas: JSON.stringify(inferirSchema(colunas, amostra)),
      status: 'concluida',
      progresso_percentual: 100,
      linhas_processadas: rowIndex,
      total_linhas: rowIndex,
      arquivo_temporario: null
    });
    logProcessamento(planilhaId, 'concluida', { linhas: rowIndex, bytes: bytesLidos, arquivo: arquivoPath });
    await removerArquivoImportacao(planilhaId, arquivoPath, 'sucesso');
  } catch (error) {
    logProcessamento(planilhaId, 'erro', { linhas: rowIndex, bytes: bytesLidos, arquivo: arquivoPath, error });
    let erroSalvo = false;
    try {
      await atualizarProgresso(planilhaId, {
        status: 'erro',
        erro_processamento: error.message || 'Erro ao processar arquivo.',
        progresso_percentual: tamanhoBytes > 0 ? Math.min(99, Math.floor((bytesLidos / tamanhoBytes) * 100)) : 0,
        linhas_processadas: rowIndex,
        total_linhas: rowIndex,
        arquivo_temporario: arquivoPath
      });
      erroSalvo = true;
    } catch (statusError) {
      logProcessamento(planilhaId, 'erro_status', { linhas: rowIndex, bytes: bytesLidos, arquivo: arquivoPath, error: statusError });
    }

    if (erroSalvo) {
      const arquivoRemovido = await removerArquivoImportacao(planilhaId, arquivoPath, 'erro_salvo');
      if (arquivoRemovido) {
        try {
          await atualizarProgresso(planilhaId, { arquivo_temporario: null });
        } catch (limpezaStatusError) {
          logProcessamento(planilhaId, 'erro_limpeza_status', { linhas: rowIndex, bytes: bytesLidos, arquivo: arquivoPath, error: limpezaStatusError });
        }
      }
    }
  }
}

/**
 * Executa a rotina iniciar upload.
 */
function iniciarUpload(req, usuarioId) {
  ensureImportDir();

  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { files: 1 } });
    let uploadPromise = null;
    let resolvido = false;

    busboy.on('file', (field, file, info) => {
      const nomeOriginal = info.filename || 'leads.csv';
      const nomeSeguro = `${Date.now()}-${Math.random().toString(16).slice(2)}.csv`;
      const arquivoPath = path.join(IMPORT_DIR, nomeSeguro);
      let tamanhoBytes = 0;
      const output = fs.createWriteStream(arquivoPath);

      logProcessamento('novo', 'upload_inicio', { arquivo: arquivoPath });

      file.on('data', chunk => {
        tamanhoBytes += chunk.length;
      });

      uploadPromise = new Promise((resolveUpload, rejectUpload) => {
        output.on('finish', async () => {
          logProcessamento('novo', 'upload_finalizado', { bytes: tamanhoBytes, arquivo: arquivoPath });
          try {
            const planilha = await LeadPlanilha.query().insertAndFetch({
              nome: nomeOriginal,
              colunas: JSON.stringify([]),
              schema_colunas: JSON.stringify({}),
              total_linhas: 0,
              linhas_processadas: 0,
              progresso_percentual: 0,
              status: 'processando',
              arquivo_temporario: arquivoPath,
              tamanho_bytes: tamanhoBytes,
              criado_por_id: usuarioId
            });

            logProcessamento(planilha.id, 'upload_registrado', { bytes: tamanhoBytes, arquivo: arquivoPath });
            setImmediate(() => {
              processarArquivoCsv(planilha.id, arquivoPath, tamanhoBytes).catch(error => {
                logProcessamento(planilha.id, 'erro_nao_tratado', { error });
              });
            });
            resolveUpload(formatarPlanilha(planilha));
          } catch (error) {
            logProcessamento('novo', 'upload_registro_erro', { bytes: tamanhoBytes, arquivo: arquivoPath, error });
            removerArquivoImportacao('novo', arquivoPath, 'falha_registro').catch(() => {});
            rejectUpload(error);
          }
        });
        output.on('error', error => {
          logProcessamento('novo', 'upload_write_erro', { bytes: tamanhoBytes, arquivo: arquivoPath, error });
          rejectUpload(error);
        });
        file.on('error', error => {
          logProcessamento('novo', 'upload_stream_erro', { bytes: tamanhoBytes, arquivo: arquivoPath, error });
          rejectUpload(error);
        });
      });

      file.pipe(output);
    });

    busboy.on('finish', async () => {
      try {
        if (!uploadPromise) throw new Error('Arquivo CSV não enviado.');
        const planilha = await uploadPromise;
        resolvido = true;
        resolve(planilha);
      } catch (error) {
        reject(error);
      }
    });

    busboy.on('error', error => {
      if (!resolvido) reject(error);
    });

    req.on('aborted', () => {
      const error = new Error('Upload interrompido pelo cliente.');
      if (!resolvido) reject(error);
    });

    req.pipe(busboy);
  });
}

/**
 * Executa a rotina csv escape.
 */
function csvEscape(valor) {
  const texto = String(valor ?? '');
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Executa a rotina exportar csv.
 */
async function exportarCsv(filtros, res, opcoes = {}) {
  const colunasOriginais = Array.isArray(filtros.colunas) ? filtros.colunas : [];
  const query = LeadLinha.query();
  aplicarFiltrosQuery(query, filtros, opcoes);
  const colunas = await expandirColunasExportacao(colunasOriginais, query);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.write(`${colunas.map(coluna => csvEscape(coluna.label || coluna.nome || coluna)).join(';')}\n`);

  let offset = 0;
  while (true) {
    const linhas = await query.clone()
      .orderBy('planilha_id', 'asc')
      .orderBy('row_index', 'asc')
      .offset(offset)
      .limit(SELECT_BATCH_SIZE);
    if (linhas.length === 0) break;

    linhas.forEach(linha => {
      const dados = parseJson(linha.dados_json, {});
      const valores = colunas.map(coluna => {
        const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
        return csvEscape(dados[source?.nome || coluna.nome || coluna]);
      });
      res.write(`${valores.join(';')}\n`);
    });

    offset += linhas.length;
  }

  res.end();
}

/**
 * Executa a rotina marcar como futuro cliente.
 */
async function marcarComoFuturoCliente(linhaId, usuarioId, dados = {}) {
  const linha = await LeadLinha.query().findById(linhaId);
  if (!linha) throw criarHttpError(404, 'Lead não encontrado.');

  if (Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Você não pode atualizar este lead.');
  }

  const notas = String(dados.notas || '').trim() || null;
  const retorno = parseDataHoraRetorno(dados.retorno);

  await db('lead_linhas')
    .where({ id: Number(linhaId) })
    .update({
      futuro_cliente: true,
      futuro_cliente_notas: notas,
      futuro_cliente_retorno: retorno,
      futuro_cliente_marcado_em: formatarDateTimeSQL(),
      futuro_cliente_marcado_por_id: usuarioId
    });

  const atualizada = await LeadLinha.query()
    .findById(linhaId)
    .withGraphFetched('[planilha, envio, atribuidoPara]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'));

  return { linha: formatarLinha(atualizada) };
}

/**
 * Executa a rotina listar futuros clientes.
 */
async function listarFuturosClientes(filtros = {}, usuarioId) {
  await limparFuturosClientesVencidosDaLixeira(usuarioId);

  const page = Math.max(1, Number(filtros.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(filtros.page_size || 50)));

  let query = LeadLinha.query()
    .where('atribuido_para_id', usuarioId)
    .where('futuro_cliente', true)
    .whereNull('futuro_cliente_excluido_em');

  query = aplicarBuscaFuturosClientes(query, filtros.busca);

  const total = await query.clone().resultSize();
  const linhas = await query
    .withGraphFetched('[planilha, envio]')
    .orderBy('futuro_cliente_marcado_em', 'desc')
    .orderBy('id', 'desc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return {
    data: linhas.map(formatarLinha),
    total,
    page,
    page_size: pageSize
  };
}

/**
 * Executa a rotina limpar futuros clientes vencidos da lixeira.
 */
async function limparFuturosClientesVencidosDaLixeira(usuarioId = null) {
  const query = db('lead_linhas')
    .where('futuro_cliente', true)
    .whereNotNull('futuro_cliente_excluido_em')
    .where('futuro_cliente_excluir_definitivo_em', '<=', formatarDateTimeSQL());

  if (usuarioId) {
    query.where('atribuido_para_id', Number(usuarioId));
  }

  return query.update({
    futuro_cliente: false,
    futuro_cliente_notas: null,
    futuro_cliente_retorno: null,
    futuro_cliente_marcado_em: null,
    futuro_cliente_marcado_por_id: null,
    futuro_cliente_excluido_em: null,
    futuro_cliente_excluir_definitivo_em: null,
    futuro_cliente_excluido_por_id: null,
    updated_at: formatarDateTimeSQL()
  });
}

/**
 * Executa a rotina listar futuros clientes lixeira.
 */
async function listarFuturosClientesLixeira(filtros = {}, usuarioId) {
  await limparFuturosClientesVencidosDaLixeira(usuarioId);

  const page = Math.max(1, Number(filtros.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(filtros.page_size || 50)));

  let query = LeadLinha.query()
    .withGraphFetched('[planilha, envio, futuroClienteExcluidoPor]')
    .modifyGraph('futuroClienteExcluidoPor', builder => builder.select('id', 'nome', 'email'))
    .where('atribuido_para_id', usuarioId)
    .where('futuro_cliente', true)
    .whereNotNull('futuro_cliente_excluido_em');

  query = aplicarBuscaFuturosClientes(query, filtros.busca);

  const total = await query.clone().resultSize();
  const linhas = await query
    .orderBy('futuro_cliente_excluido_em', 'desc')
    .orderBy('id', 'desc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  return {
    data: linhas.map(formatarLinha),
    total,
    page,
    page_size: pageSize
  };
}

/**
 * Executa a rotina enviar futuro cliente para lixeira.
 */
async function enviarFuturoClienteParaLixeira(linhaId, usuarioId) {
  const agora = new Date();

  return db('lead_linhas')
    .where('id', Number(linhaId))
    .where('atribuido_para_id', Number(usuarioId))
    .where('futuro_cliente', true)
    .whereNull('futuro_cliente_excluido_em')
    .update({
      futuro_cliente_excluido_em: formatarDateTimeSQL(agora),
      futuro_cliente_excluir_definitivo_em: formatarDateTimeSQL(adicionarDias(agora, 30)),
      futuro_cliente_excluido_por_id: usuarioId,
      updated_at: formatarDateTimeSQL(agora)
    });
}

/**
 * Executa a rotina restaurar futuro cliente.
 */
async function restaurarFuturoCliente(linhaId, usuarioId) {
  const atualizados = await db('lead_linhas')
    .where('id', Number(linhaId))
    .where('atribuido_para_id', Number(usuarioId))
    .where('futuro_cliente', true)
    .whereNotNull('futuro_cliente_excluido_em')
    .update({
      futuro_cliente_excluido_em: null,
      futuro_cliente_excluir_definitivo_em: null,
      futuro_cliente_excluido_por_id: null,
      updated_at: formatarDateTimeSQL()
    });

  if (!atualizados) return null;

  const atualizada = await LeadLinha.query()
    .findById(linhaId)
    .withGraphFetched('[planilha, envio]');

  return formatarLinha(atualizada);
}

/**
 * Executa a rotina excluir futuro cliente definitivo.
 */
async function excluirFuturoClienteDefinitivo(linhaId, usuarioId) {
  return db('lead_linhas')
    .where('id', Number(linhaId))
    .where('atribuido_para_id', Number(usuarioId))
    .where('futuro_cliente', true)
    .whereNotNull('futuro_cliente_excluido_em')
    .update({
      futuro_cliente: false,
      futuro_cliente_notas: null,
      futuro_cliente_retorno: null,
      futuro_cliente_marcado_em: null,
      futuro_cliente_marcado_por_id: null,
      futuro_cliente_excluido_em: null,
      futuro_cliente_excluir_definitivo_em: null,
      futuro_cliente_excluido_por_id: null,
      updated_at: formatarDateTimeSQL()
    });
}

module.exports = {
  listarPlanilhas,
  buscarStatus,
  iniciarUpload,
  criarPlanilha,
  salvarLinhasLote,
  finalizarPlanilha,
  marcarErroPlanilha,
  atualizarSchema,
  excluirPlanilha,
  listarLinhas,
  atualizarCampoLinhaRecebida,
  listarEnviosDoUsuario,
  listarTodosEnvios,
  dividirLeads,
  exportarCsv,
  marcarComoFuturoCliente,
  listarFuturosClientes,
  listarFuturosClientesLixeira,
  enviarFuturoClienteParaLixeira,
  restaurarFuturoCliente,
  excluirFuturoClienteDefinitivo
};
