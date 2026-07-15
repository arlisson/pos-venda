const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Busboy = require('busboy');
const ExcelJS = require('exceljs');
/**
 * Servico de importacao, distribuicao e acompanhamento de planilhas de leads.
 */
const LeadPlanilha = require('../models/LeadPlanilha');
const LeadLinha = require('../models/LeadLinha');
const LeadEnvio = require('../models/LeadEnvio');
const LeadEnvioUsuario = require('../models/LeadEnvioUsuario');
const LeadAtribuicao = require('../models/LeadAtribuicao');
const LeadSondagem = require('../models/LeadSondagem');
const db = require('../database/connection');
const { parseUtcDateTime } = require('../utils/datetime');
const clienteAntigoService = require('./cliente-antigo.service');
const { restaurarZerosCnpj } = require('./cnpj.service');
const telegramService = require('./telegram.service');

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
const EXCEL_IMPORT_BATCH_SIZE = 5000;
const PALAVRAS_COLUNA_DOCUMENTO = ['cnpj', 'cpf', 'documento'];
const EXCEL_IMPORT_MAX_BYTES = Number(process.env.LEAD_EXCEL_IMPORT_MAX_BYTES || 50 * 1024 * 1024);
const TERMOS_CABECALHO_MAILING = [
  'cnpj',
  'cpf/cnpj',
  'documento',
  'razao social',
  'empresa',
  'nome fantasia',
  'acessos',
  'consultor',
  'data de ativacao',
  'terminal',
  'status',
  'operadora',
  'telefone',
  'whatsapp',
  'contato',
  'responsavel',
  'quantidade de chips',
  'qtd chips',
  'chips',
  'data da venda',
  'data venda',
  'email',
  'e-mail',
  'cidade',
  'uf'
];

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
 * Aguarda o intervalo informado antes de continuar.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verifica se transient db error atende a condicao esperada.
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
 * Processa log processamento conforme as regras do dominio.
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
 * Remove arquivo importacao da colecao ou estado atual.
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
 * Executa a operacao de banco com tentativas em erros transitorios.
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
 * Processa inserir lead linhas conforme as regras do dominio.
 */
async function inserirLeadLinhas(planilhaId, linhas, etapa) {
  if (!linhas.length) return;

  if (USAR_LOAD_INFILE) {
    return inserirViaLoadInfile(planilhaId, linhas, etapa);
  }

  let lote = [];
  let loteBytes = 0;

  /**
   * Envia o lote acumulado e reinicia o buffer.
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
 * Escapa escape load infile value para evitar quebra de formato.
 */
function escapeLoadInfileValue(valor) {
  return String(valor)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Processa inserir via load infile conforme as regras do dominio.
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
 * Cria http error com os dados informados.
 */
function criarHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Formata date time sql para exibicao ou envio.
 */
function formatarDateTimeSQL(data = new Date()) {
  /**
   * Preenche valores numericos com zero a esquerda.
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
 * Converte data hora retorno para o formato interno esperado.
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
 * Adiciona dias ao conjunto atual.
 */
function adicionarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/**
 * Aplica busca futuros clientes sobre a consulta ou conjunto informado.
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
 * Converte json para o formato interno esperado.
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
 * Formata planilha para exibicao ou envio.
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
 * Reconcilia planilha processando com o estado persistido.
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
 * Formata envio para exibicao ou envio.
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
 * Formata linha para exibicao ou envio.
 */
function formatarLinha(linha) {
  const json = typeof linha?.toJSON === 'function' ? linha.toJSON() : linha;
  if (!json) return json;

  const sondagem = json.sondagem ? {
    ...json.sondagem,
    chips_itens: parseJson(json.sondagem.chips_itens, [])
  } : json.sondagem;
  const retornoLinhaValido = json.futuro_cliente_retorno
    && !String(json.futuro_cliente_retorno).startsWith('0000-00-00');
  const marcadoLinhaValido = json.futuro_cliente_marcado_em
    && !String(json.futuro_cliente_marcado_em).startsWith('0000-00-00');
  return {
    ...json,
    dados_json: parseJson(json.dados_json, {}),
    sondagem,
    futuro_cliente_retorno: retornoLinhaValido ? json.futuro_cliente_retorno : (sondagem?.retorno_em || null),
    futuro_cliente_marcado_em: marcadoLinhaValido ? json.futuro_cliente_marcado_em : (sondagem?.respondido_em || null),
    planilha: formatarPlanilha(json.planilha),
    envio: formatarEnvio(json.envio)
  };
}

/**
 * Lista planilhas conforme os filtros e parametros informados.
 */
async function listarPlanilhas() {
  const planilhas = await LeadPlanilha.query()
    .withGraphFetched('criador')
    .modifyGraph('criador', builder => builder.select('id', 'nome', 'email'))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  const planilhaIds = planilhas.map(planilha => Number(planilha.id)).filter(Boolean);
  const enviadosPorPlanilha = new Map();
  const metricasPorPlanilha = new Map();
  if (planilhaIds.length > 0) {
    const totais = await LeadLinha.query()
      .select('planilha_id')
      .count('id as total_enviados')
      .whereIn('planilha_id', planilhaIds)
      .whereNotNull('envio_id')
      .groupBy('planilha_id');
    totais.forEach(item => enviadosPorPlanilha.set(Number(item.planilha_id), Number(item.total_enviados || 0)));

    const metricas = await LeadLinha.query()
      .select('planilha_id')
      .select(db.raw('SUM(CASE WHEN cliente_recusou = 1 THEN 1 ELSE 0 END) as total_recusados'))
      .select(db.raw(
        'SUM(CASE WHEN futuro_cliente = 1 AND futuro_cliente_excluido_em IS NULL '
        + 'THEN 1 ELSE 0 END) as total_futuros'
      ))
      .whereIn('planilha_id', planilhaIds)
      .groupBy('planilha_id');
    metricas.forEach(item => metricasPorPlanilha.set(Number(item.planilha_id), {
      totalRecusados: Number(item.total_recusados || 0),
      totalFuturos: Number(item.total_futuros || 0)
    }));
  }

  const reconciliadas = [];
  for (const planilha of planilhas) {
    reconciliadas.push(await reconciliarPlanilhaProcessando(planilha));
  }

  return reconciliadas.map(planilha => {
    const formatada = formatarPlanilha(planilha);
    const totalEnviados = enviadosPorPlanilha.get(Number(formatada.id)) || 0;
    const metricas = metricasPorPlanilha.get(Number(formatada.id))
      || { totalRecusados: 0, totalFuturos: 0 };
    return {
      ...formatada,
      total_enviados: totalEnviados,
      total_pendentes: Math.max(0, formatada.total_linhas - totalEnviados),
      total_recusados: metricas.totalRecusados,
      total_futuros: metricas.totalFuturos
    };
  });
}

/**
 * Busca status conforme os parametros informados.
 */
async function buscarStatus(planilhaId) {
  const planilha = await LeadPlanilha.query().findById(planilhaId);
  return formatarPlanilha(await reconciliarPlanilhaProcessando(planilha));
}

/**
 * Cria planilha com os dados informados.
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
 * Salva linhas lote com os dados informados.
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
 * Executa a acao de finalizar planilha mantendo o estado da tela consistente.
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
 * Marca erro planilha conforme a acao solicitada.
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
 * Atualiza schema com os dados informados.
 */
async function atualizarSchema(planilhaId, schemaColunas) {
  const planilha = await LeadPlanilha.query().patchAndFetchById(planilhaId, {
    schema_colunas: JSON.stringify(schemaColunas || {}),
    updated_at: new Date()
  });

  return planilha ? formatarPlanilha(planilha) : null;
}

/**
 * Exclui planilha conforme a regra de negocio.
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
 * Extrai ids numericos da query recebida.
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
 * Retorna json value expr a partir dos dados informados.
 */
function getJsonValueExpr(coluna) {
  const pathSeguro = String(coluna || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `JSON_UNQUOTE(JSON_EXTRACT(dados_json, '$."${pathSeguro}"'))`;
}

/**
 * Retorna coluna nome a partir dos dados informados.
 */
function getColunaNome(coluna) {
  return coluna?.nome || coluna?.label || coluna;
}

/**
 * Cria coluna atualizada com os dados informados.
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
 * Retorna coluna atualizada existe no formato esperado pelo fluxo.
 */
function colunaAtualizadaExiste(coluna, chavesAtualizadas) {
  if (!coluna || String(getColunaNome(coluna)).endsWith(UPDATED_COLUMN_SUFFIX)) return false;

  if (Array.isArray(coluna.sources) && coluna.sources.length > 0) {
    return coluna.sources.some(source => chavesAtualizadas.has(`${source.nome}${UPDATED_COLUMN_SUFFIX}`));
  }

  return chavesAtualizadas.has(`${getColunaNome(coluna)}${UPDATED_COLUMN_SUFFIX}`);
}

/**
 * Processa coletar chaves atualizadas conforme as regras do dominio.
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
 * Expande colunas exportacao em linhas ou colunas detalhadas.
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
 * Aplica filtros query sobre a consulta ou conjunto informado.
 */
function aplicarFiltrosQuery(query, filtros = {}, opcoes = {}) {
  const planilhaIds = idsFromQuery(filtros.planilha_ids);
  const envioIds = idsFromQuery(filtros.envio_ids);

  if (planilhaIds.length > 0) query.whereIn('planilha_id', planilhaIds);
  if (envioIds.length > 0) query.whereIn('envio_id', envioIds);
  const linhaId = Number(filtros.linha_id || 0);
  if (Number.isInteger(linhaId) && linhaId > 0) query.where('id', linhaId);
  if (opcoes.usuarioId) query.where('atribuido_para_id', Number(opcoes.usuarioId));
  if (filtros.etapa) query.where('etapa_atual', String(filtros.etapa));
  if (filtros.somente_qualificados === true || filtros.somente_qualificados === 'true') {
    query.where('futuro_cliente', true).whereNull('futuro_cliente_excluido_em');
  }
  if (filtros.disponivel_venda === true || filtros.disponivel_venda === 'true') {
    query.where('status_operacional', 'qualificado');
  }

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
 * Lista linhas conforme os filtros e parametros informados.
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
  const qualificados = await baseQuery.clone()
    .where('futuro_cliente', true)
    .whereNull('futuro_cliente_excluido_em')
    .resultSize();
  const linhas = await baseQuery
    .withGraphFetched('[planilha, envio, atribuidoPara, sondagem.[operadoraAtual, usuario]]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'))
    .orderBy('planilha_id', 'asc')
    .orderBy('row_index', 'asc')
    .offset((page - 1) * pageSize)
    .limit(pageSize);

  const cnpjsPagina = new Set();
  linhas.forEach(linha => extrairCnpjsLinha(linha).forEach(cnpj => cnpjsPagina.add(cnpj)));
  const clientesPorCnpj = cnpjsPagina.size
    ? await db('clientes').whereIn('cnpj_digitos', Array.from(cnpjsPagina)).select('id', 'cnpj_digitos')
    : [];
  const clienteIds = clientesPorCnpj.map(cliente => Number(cliente.id));
  const clientesComVenda = clienteIds.length
    ? await db('vendas').whereIn('cliente_id', clienteIds).whereNull('excluido_em').distinct('cliente_id')
    : [];
  const idsComVenda = new Set(clientesComVenda.map(item => Number(item.cliente_id)));
  const cnpjsComVenda = new Set(clientesPorCnpj
    .filter(cliente => idsComVenda.has(Number(cliente.id)))
    .map(cliente => cliente.cnpj_digitos));

  return {
    data: linhas.map(linha => ({
      ...formatarLinha(linha),
      possui_venda_cliente: Array.from(extrairCnpjsLinha(linha)).some(cnpj => cnpjsComVenda.has(cnpj))
    })),
    total,
    resumo: {
      total,
      enviados,
      qualificados,
      nao_enviados: Math.max(0, total - enviados)
    },
    page,
    page_size: pageSize
  };
}

/**
 * Atualiza campo linha recebida com os dados informados.
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
 * Lista envios do usuario conforme os filtros e parametros informados.
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

  // O envio pode ter sido dividido entre varios vendedores: as metricas do card
  // sao pessoais, contando apenas as linhas atribuidas a este usuario.
  const envioIds = envios.map(envio => Number(envio.id)).filter(Boolean);
  const metricasPorEnvio = new Map();
  if (envioIds.length > 0) {
    const totais = await LeadLinha.query()
      .select('envio_id')
      .count('id as total_linhas')
      .select(db.raw(
        'SUM(CASE WHEN (futuro_cliente = 1 AND futuro_cliente_excluido_em IS NULL) '
        + 'OR venda_recusada_em IS NOT NULL OR cliente_recusou = 1 THEN 1 ELSE 0 END) as total_trabalhados'
      ))
      .select(db.raw('SUM(CASE WHEN cliente_recusou = 1 THEN 1 ELSE 0 END) as total_recusados'))
      .select(db.raw(
        'SUM(CASE WHEN futuro_cliente = 1 AND futuro_cliente_excluido_em IS NULL '
        + 'THEN 1 ELSE 0 END) as total_futuros'
      ))
      .whereIn('envio_id', envioIds)
      .where('atribuido_para_id', usuarioId)
      .groupBy('envio_id');

    totais.forEach(item => metricasPorEnvio.set(Number(item.envio_id), {
      totalLinhas: Number(item.total_linhas || 0),
      totalTrabalhados: Number(item.total_trabalhados || 0),
      totalRecusados: Number(item.total_recusados || 0),
      totalFuturos: Number(item.total_futuros || 0)
    }));
  }

  return envios.map(envio => {
    const formatado = formatarEnvio(envio);
    const metricas = metricasPorEnvio.get(Number(formatado.id))
      || { totalLinhas: 0, totalTrabalhados: 0, totalRecusados: 0, totalFuturos: 0 };
    return {
      ...formatado,
      total_linhas: metricas.totalLinhas,
      total_trabalhados: metricas.totalTrabalhados,
      total_recusados: metricas.totalRecusados,
      total_futuros: metricas.totalFuturos,
      total_a_trabalhar: Math.max(0, metricas.totalLinhas - metricas.totalTrabalhados)
    };
  });
}

/**
 * Lista todos envios conforme os filtros e parametros informados.
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
 * Monta alocacoes a partir dos dados informados.
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
 * Busca ids por criterios conforme os parametros informados.
 */
async function buscarIdsPorCriterios(dados, quantidadeTotal) {
  if (Array.isArray(dados.linha_ids) && dados.linha_ids.length > 0) {
    const ids = dados.linha_ids.map(Number).filter(Boolean).slice(0, quantidadeTotal);
    if (dados.etapa !== 'venda') return ids;
    const qualificados = await LeadLinha.query()
      .whereIn('id', ids)
      .where('futuro_cliente', true)
      .whereNull('futuro_cliente_excluido_em')
      .where('status_operacional', 'qualificado')
      .select('id');
    const permitidos = new Set(qualificados.map(item => Number(item.id)));
    return ids.filter(id => permitidos.has(Number(id)));
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
 * Processa dividir leads conforme as regras do dominio.
 */
async function dividirLeads(dados, usuarioId) {
  const usuarioIds = Array.isArray(dados.usuario_ids)
    ? dados.usuario_ids.map(Number).filter(Boolean)
    : [];
  const quantidadeTotal = Number(dados.quantidade_total || 0);
  const etapa = dados.etapa === 'venda' ? 'venda' : 'sondagem';

  if (!String(dados.nome || '').trim()) throw new Error('Informe um nome para o envio.');
  if (usuarioIds.length === 0) throw new Error('Selecione ao menos um vendedor.');
  if (quantidadeTotal <= 0) throw new Error('Quantidade de clientes invalida.');

  const linhaIds = await buscarIdsPorCriterios(dados, quantidadeTotal);
  if (linhaIds.length < quantidadeTotal) {
    if (etapa === 'venda') {
      throw new Error(`Ha somente ${linhaIds.length} futuro(s) cliente(s) qualificado(s) e disponivel(is) para venda.`);
    }
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
            etapa_atual: etapa,
            status_operacional: etapa === 'venda' ? 'distribuido_venda' : 'pendente',
            updated_at: new Date()
          });
      }

      if (idsUsuario.length) {
        const atribuicoes = idsUsuario.map(leadLinhaId => ({
          lead_linha_id: leadLinhaId,
          envio_id: envio.id,
          usuario_id: usuarioAlvoId,
          etapa,
          status: 'atribuido',
          criado_por_id: usuarioId
        }));
        for (let i = 0; i < atribuicoes.length; i += 500) {
          await trx('lead_atribuicoes').insert(atribuicoes.slice(i, i + 500));
        }
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
 * Processa processar removido ini conforme as regras do dominio.
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
   * Atualiza progresso por bytes com os dados informados.
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
   * Envia o lote acumulado e reinicia o buffer.
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
 * Normaliza colunas duplicadas para manter compatibilidade com o importador CSV.
 */
function normalizarColunasDuplicadas(colunas) {
  const contadores = {};
  return colunas.map((coluna, index) => {
    const base = String(coluna || '').trim() || `Coluna ${index + 1}`;
    const chave = base.toLowerCase();
    contadores[chave] = (contadores[chave] || 0) + 1;
    return contadores[chave] === 1 ? base : `${base} (${contadores[chave]})`;
  });
}

/**
 * Converte valores de celula do Excel para texto simples importavel.
 */
function valorCelulaExcel(celula) {
  const valor = celula?.value;
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? '' : valor.toISOString().slice(0, 10);
  if (Array.isArray(valor?.richText)) return valor.richText.map(item => item.text || '').join('');
  if (valor && typeof valor === 'object') {
    if (valor.result !== undefined) return String(valor.result ?? '').trim();
    if (valor.text !== undefined) return String(valor.text ?? '').trim();
    if (valor.hyperlink !== undefined) return String(valor.hyperlink ?? '').trim();
  }
  return String(valor ?? '').trim();
}

/**
 * Le a celula da coluna de documento sem perder zeros a esquerda: o Excel guarda
 * o cnpj como numero e `01.234.567/0001-89` chegaria como 1234567000189. O texto
 * formatado da celula ja traz os zeros quando a planilha usa formato customizado;
 * so quando ele nao ajuda reconstruimos os zeros pelos digitos.
 */
function valorCelulaDocumento(celula) {
  const bruto = valorCelulaExcel(celula);
  if (contarDigitos(bruto) === 14) return bruto;

  const formatado = String(celula?.text ?? '');
  if (contarDigitos(formatado) === 14) return formatado.trim();

  return restaurarZerosCnpj(bruto) || bruto;
}

/**
 * Completa os zeros a esquerda de um documento vindo como texto (csv). Valores
 * que ja tem os 14 digitos ficam como estao, inclusive a mascara.
 */
function textoDocumentoLead(valor) {
  if (contarDigitos(valor) === 14) return valor;
  return restaurarZerosCnpj(valor) || valor;
}

function contarDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '').length;
}

/**
 * Indices (base 0) das colunas que carregam cnpj/cpf, seja pelo mapeamento
 * escolhido na tela ou pelo nome do cabecalho.
 */
function indicesColunasDocumento(colunasNomes, colunaMapeada = null) {
  const indices = new Set();
  colunasNomes.forEach((nome, index) => {
    const normalizado = normalizarBuscaColunaLead(nome);
    const ehDocumento = PALAVRAS_COLUNA_DOCUMENTO.some(palavra => normalizado.includes(palavra));
    const ehMapeada = colunaMapeada && nome === colunaMapeada;
    if (ehDocumento || ehMapeada) indices.add(index);
  });
  return indices;
}

function normalizarBuscaColunaLead(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokensBuscaColunaLead(valor) {
  return normalizarBuscaColunaLead(valor)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function colunaCombinaBuscaLead(nomeColuna, busca) {
  const termo = normalizarBuscaColunaLead(busca);
  const nome = normalizarBuscaColunaLead(nomeColuna);
  if (!termo || !nome) return false;
  if (nome === termo || nome.includes(termo)) return true;

  const tokens = tokensBuscaColunaLead(busca);
  return tokens.length > 0 && tokens.every(token => nome.includes(token));
}

function linhaContemColunaLead(valores, busca) {
  if (!busca) return false;
  return valores.some(valor => colunaCombinaBuscaLead(valor, busca));
}

function colunaPareceCabecalhoLead(nomeColuna, busca) {
  const termo = normalizarBuscaColunaLead(busca);
  const nome = normalizarBuscaColunaLead(nomeColuna);
  if (!termo || !nome) return false;
  if (nome === termo) return true;
  return nome.includes(termo) && nome.length <= 40;
}

function linhaContemCabecalhoLead(valores, busca) {
  if (!busca) return false;
  return valores.some(valor => colunaPareceCabecalhoLead(valor, busca));
}

function pontuarLinhaCabecalhoMailing(valores, buscaCnpj = null) {
  const preenchidos = valores.filter(valor => String(valor || '').trim());
  if (preenchidos.length < 2) return 0;

  const termosEncontrados = new Set();
  for (const valor of preenchidos) {
    TERMOS_CABECALHO_MAILING.forEach(termo => {
      if (colunaPareceCabecalhoLead(valor, termo)) termosEncontrados.add(termo);
    });
  }

  let score = termosEncontrados.size;
  if (buscaCnpj && linhaContemCabecalhoLead(preenchidos, buscaCnpj)) score += 3;
  if (linhaContemCabecalhoLead(preenchidos, 'cnpj') || linhaContemCabecalhoLead(preenchidos, 'cpf/cnpj')) score += 2;
  if (preenchidos.length >= 4) score += 1;

  return score;
}

function escolherLinhaCabecalhoMailing(linhasCandidatas, opcoes = {}) {
  if (!linhasCandidatas.length) return null;

  if (opcoes.cnpj) {
    const linhaMapeada = linhasCandidatas.find(candidata => linhaContemCabecalhoLead(candidata.valores, opcoes.cnpj));
    if (linhaMapeada) return linhaMapeada;
  }

  let melhor = null;
  for (const candidata of linhasCandidatas) {
    const score = pontuarLinhaCabecalhoMailing(candidata.valores, opcoes.cnpj);
    if (!melhor || score > melhor.score) melhor = { ...candidata, score };
  }

  return melhor?.score >= 3 ? melhor : linhasCandidatas[0];
}
function parseNumeroLead(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  const limpo = texto.replace(/\s/g, '').replace(/^R\$/i, '');
  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');
  let normalizado = limpo;

  if (temVirgula && temPonto) {
    normalizado = limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function parseDataLead(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!br) return null;
  const [, dia, mes, ano] = br;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function inferirSchemaLead(colunas, amostra) {
  return colunas.reduce((acc, coluna) => {
    const valores = amostra.map(linha => linha[coluna]).filter(valor => String(valor || '').trim() !== '');
    const total = valores.length || 1;
    const numeros = valores.filter(valor => parseNumeroLead(valor) !== null).length;
    const datas = valores.filter(valor => parseDataLead(valor) !== null).length;
    acc[coluna] = datas / total >= 0.75 ? 'date' : (numeros / total >= 0.75 ? 'number' : 'string');
    return acc;
  }, {});
}

function parseBooleanCampo(valor) {
  return valor === true || valor === 'true' || valor === '1' || valor === 1 || valor === 'sim';
}

function normalizarNomeAbaLead(valor) {
  return String(valor || '').trim().toLowerCase();
}

function parseJsonArrayCampo(valor) {
  if (!valor) return null;
  const parsed = JSON.parse(valor);
  return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : null;
}

function parseJsonObjectCampo(valor) {
  if (!valor) return null;
  const parsed = JSON.parse(valor);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function parseCsvLineLead(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function detectDelimiterLead(line) {
  return [';', ',', '\t'].reduce((best, delimiter) => (
    parseCsvLineLead(line, delimiter).length > parseCsvLineLead(line, best).length ? delimiter : best
  ), ';');
}

function detectDelimiterLinhasLead(linhasTexto) {
  const amostra = linhasTexto.slice(0, 20);
  return [';', ',', '\t'].reduce((best, delimiter) => {
    const melhorAtual = Math.max(...amostra.map(linha => parseCsvLineLead(linha, best).length));
    const melhorCandidato = Math.max(...amostra.map(linha => parseCsvLineLead(linha, delimiter).length));
    return melhorCandidato > melhorAtual ? delimiter : best;
  }, ';');
}

function lerUploadPlanilhaMailing(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: EXCEL_IMPORT_MAX_BYTES } });
    const campos = {};
    let chunks = [];
    let nomeOriginal = '';
    let recebeuArquivo = false;
    let erroLimite = null;

    busboy.on('field', (name, value) => {
      campos[name] = value;
    });

    busboy.on('file', (field, file, info) => {
      recebeuArquivo = true;
      nomeOriginal = info.filename || 'leads.xlsx';
      const filename = String(nomeOriginal).toLowerCase();
      if (!filename.endsWith('.xlsx') && !filename.endsWith('.csv')) {
        erroLimite = new Error('Envie um arquivo .csv ou .xlsx.');
        file.resume();
        return;
      }

      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => {
        erroLimite = new Error('Arquivo excede o limite permitido.');
        chunks = [];
      });
      file.on('error', reject);
    });

    busboy.on('finish', () => {
      if (erroLimite) return reject(erroLimite);
      if (!recebeuArquivo) return reject(new Error('Arquivo nao enviado.'));
      return resolve({ nomeOriginal, buffer: Buffer.concat(chunks), campos });
    });
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

function montarColecaoCsv(nomeOriginal, buffer) {
  const texto = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const linhasTexto = texto.split(/\r?\n/).filter(linha => linha.trim());
  if (!linhasTexto.length) throw new Error('CSV sem cabecalho valido.');

  const delimiter = detectDelimiterLinhasLead(linhasTexto);
  const linhasCandidatas = linhasTexto.slice(0, 20).map((linha, index) => ({
    rowNumber: index + 1,
    valores: parseCsvLineLead(linha.replace(/^\uFEFF/, ''), delimiter)
  }));
  const cabecalho = escolherLinhaCabecalhoMailing(linhasCandidatas);
  const headerIndex = Math.max((cabecalho?.rowNumber || 1) - 1, 0);
  const colunasNomes = normalizarColunasDuplicadas(cabecalho?.valores || parseCsvLineLead(linhasTexto[0], delimiter));
  const colunas = colunasNomes.map((nome, index) => ({ nome, index: index + 1 }));
  const colunasDocumento = indicesColunasDocumento(colunasNomes);
  const linhas = [];

  for (let i = headerIndex + 1; i < linhasTexto.length; i += 1) {
    const values = parseCsvLineLead(linhasTexto[i], delimiter);
    const dados = { __rowIndex: i + 1 };
    let vazia = true;
    colunasNomes.forEach((coluna, index) => {
      const bruto = values[index] ?? '';
      const valor = colunasDocumento.has(index) ? textoDocumentoLead(bruto) : bruto;
      if (String(valor || '').trim()) vazia = false;
      dados[coluna] = valor;
    });
    if (!vazia) linhas.push(dados);
  }

  return [{ nome: nomeOriginal, colunas, linhas }];
}
function montarColecoesExcel(nomeOriginal, workbook, abasSelecionadas = null, opcoes = {}) {
  const selecionadas = Array.isArray(abasSelecionadas) && abasSelecionadas.length > 0
    ? new Set(abasSelecionadas.map(normalizarNomeAbaLead))
    : null;

  return workbook.worksheets
    .filter(worksheet => !selecionadas || selecionadas.has(normalizarNomeAbaLead(worksheet.name)))
    .map(worksheet => {
    const linhasCandidatas = [];
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const valores = [];
      for (let colNumber = 1; colNumber <= row.cellCount; colNumber += 1) {
        valores.push(valorCelulaExcel(row.getCell(colNumber)));
      }
      if (!valores.some(valor => String(valor || '').trim() !== '')) continue;

      linhasCandidatas.push({ rowNumber, valores });
    }

    const cabecalho = escolherLinhaCabecalhoMailing(linhasCandidatas, opcoes);
    const headerRowNumber = cabecalho?.rowNumber || 0;
    const colunasNomes = cabecalho ? normalizarColunasDuplicadas(cabecalho.valores) : [];
    if (!headerRowNumber || colunasNomes.length === 0) {
      return null;
    }

    const colunasDocumento = indicesColunasDocumento(colunasNomes, opcoes.cnpj);
    const linhas = [];
    for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const dados = { __rowIndex: rowNumber };
      let vazia = true;

      colunasNomes.forEach((coluna, index) => {
        const celula = row.getCell(index + 1);
        const valor = colunasDocumento.has(index) ? valorCelulaDocumento(celula) : valorCelulaExcel(celula);
        if (String(valor || '').trim() !== '') vazia = false;
        dados[coluna] = valor;
      });

      if (!vazia) linhas.push(dados);
    }

    return {
      nome: worksheet.name,
      nomePlanilha: String(worksheet.name || '').trim() || nomeOriginal,
      colunas: colunasNomes.map((nome, index) => ({ nome, index: index + 1 })),
      linhas
    };
  }).filter(Boolean);
}

async function salvarColecaoMailing(colecao, usuarioId) {
  const colunas = colecao.colunas.map(coluna => coluna.nome);
  const planilha = await criarPlanilha({
    nome: colecao.nomePlanilha || colecao.nome,
    colunas: [],
    schema_colunas: {},
    total_linhas: 0,
    streaming: true
  }, usuarioId);

  let lote = [];
  const amostra = [];

  async function flush() {
    if (!lote.length) return;
    await salvarLinhasLote(planilha.id, lote);
    lote = [];
  }

  try {
    for (let index = 0; index < colecao.linhas.length; index += 1) {
      const linha = colecao.linhas[index];
      const dados = {};
      colunas.forEach(coluna => {
        dados[coluna] = linha[coluna] ?? '';
      });
      if (amostra.length < 200) amostra.push(dados);
      lote.push({ row_index: index, dados_json: dados });
      if (lote.length >= EXCEL_IMPORT_BATCH_SIZE) await flush();
    }

    await flush();
    return finalizarPlanilha(planilha.id, {
      colunas,
      schema_colunas: inferirSchemaLead(colunas, amostra)
    });
  } catch (error) {
    await marcarErroPlanilha(planilha.id, error.message || 'Erro ao importar planilha.').catch(() => {});
    throw error;
  }
}

async function importarColecoesMailing(nomeOriginal, colecoes, usuarioId, opcoes = {}) {
  if (!colecoes.length) throw new Error('Planilha sem cabecalho valido.');

  const planilhas = [];
  for (const colecao of colecoes) {
    planilhas.push(await salvarColecaoMailing(colecao, usuarioId));
  }

  let baseAntiga = null;
  if (opcoes.baseAntiga) {
    baseAntiga = await clienteAntigoService.importarColecaoPlanilhas(colecoes, {
      usuarioId,
      arquivoNome: nomeOriginal,
      mapeamento: opcoes.mapeamento || null
    });
  }

  return { planilhas, base_antiga: baseAntiga };
}

/**
 * Importa uma planilha Excel de mailing preservando o formato de linhas do CSV.
 */
async function importarExcel(req, usuarioId) {
  const { nomeOriginal, buffer, campos } = await lerUploadPlanilhaMailing(req);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) throw new Error('A planilha XLSX nao possui abas.');
  const abas = parseJsonArrayCampo(campos.abas);
  const mapeamento = parseJsonObjectCampo(campos.mapeamento);
  const colecoes = montarColecoesExcel(nomeOriginal, workbook, abas, { cnpj: mapeamento?.cnpj });
  return importarColecoesMailing(nomeOriginal, colecoes, usuarioId, {
    baseAntiga: parseBooleanCampo(campos.base_antiga),
    mapeamento
  });
}

async function importarBaseAntigaArquivo(req, usuarioId) {
  const { nomeOriginal, buffer, campos } = await lerUploadPlanilhaMailing(req);
  const lower = String(nomeOriginal || '').toLowerCase();
  let colecoes;

  if (lower.endsWith('.csv')) {
    colecoes = montarColecaoCsv(nomeOriginal, buffer);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    colecoes = montarColecoesExcel(nomeOriginal, workbook, parseJsonArrayCampo(campos.abas), { cnpj: campos.mapeamento ? JSON.parse(campos.mapeamento)?.cnpj : null });
  }

  return clienteAntigoService.importarColecaoPlanilhas(colecoes, {
    usuarioId,
    arquivoNome: nomeOriginal,
    mapeamento: campos.mapeamento ? JSON.parse(campos.mapeamento) : null
  });
}
/**
 * Executa a acao de iniciar upload mantendo o estado da tela consistente.
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
 * Escapa csv escape para evitar quebra de formato.
 */
function csvEscape(valor) {
  const texto = String(valor ?? '');
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Exporta csv no formato esperado.
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
 * Marca como futuro cliente conforme a acao solicitada.
 */
async function marcarComoFuturoCliente(linhaId, usuarioId, dados = {}) {
  const linha = await LeadLinha.query().findById(linhaId);
  if (linha?.futuro_cliente && Number(linha.futuro_cliente_marcado_por_id) !== Number(usuarioId)) {
    throw criarHttpError(409, 'Este lead ja foi qualificado na primeira ligacao e nao pode ser qualificado novamente.');
  }
  if (!linha) throw criarHttpError(404, 'Lead não encontrado.');

  if (Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Você não pode atualizar este lead.');
  }

  const eraFuturoCliente = Boolean(linha.futuro_cliente);

  const razaoSocial = String(dados.razao_social || '').trim().slice(0, 240) || null;
  const cnpj = String(dados.cnpj || '').trim().slice(0, 20) || null;
  const contatoNome = String(dados.contato_nome || '').trim();
  const contatoTipo = String(dados.contato_tipo || '').trim().toLowerCase();
  const operadoraAtualId = Number(dados.operadora_atual_id || 0);
  const chipsRecebidos = Array.isArray(dados.chips_itens) ? dados.chips_itens : [];
  const chipsItens = (chipsRecebidos.length ? chipsRecebidos : [{
    quantidade: dados.quantidade_chips,
    preco_por_chip: dados.preco_por_chip
  }]).map(item => ({
    quantidade: Number(item.quantidade || 0),
    preco_por_chip: Number(String(item.preco_por_chip ?? '').replace(',', '.'))
  }));
  const telefoneDigitos = String(dados.whatsapp || `${dados.whatsapp_ddd || ''}${dados.whatsapp_numero || ''}`).replace(/\D/g, '');
  const whatsapp = telefoneDigitos.startsWith('55') && telefoneDigitos.length > 11 ? telefoneDigitos.slice(2) : telefoneDigitos;
  const whatsappDdd = whatsapp.slice(0, 2);
  const whatsappNumero = whatsapp.slice(2);

  if (!contatoNome) throw criarHttpError(400, 'Informe o nome de quem falou.');
  if (!['adm', 'rl'].includes(contatoTipo)) throw criarHttpError(400, 'Informe se o contato e ADM ou RL.');
  if (!Number.isInteger(operadoraAtualId) || operadoraAtualId <= 0) throw criarHttpError(400, 'Informe a operadora atual.');
  if (!chipsItens.length || chipsItens.some(item => !Number.isInteger(item.quantidade) || item.quantidade <= 0)) {
    throw criarHttpError(400, 'Informe quantidades de chips validas.');
  }
  if (chipsItens.some(item => !Number.isFinite(item.preco_por_chip) || item.preco_por_chip <= 0)) {
    throw criarHttpError(400, 'Informe precos por chip validos.');
  }
  if (whatsappDdd.length !== 2 || whatsappNumero.length < 8 || whatsappNumero.length > 9) {
    throw criarHttpError(400, 'Informe um WhatsApp com DDD valido.');
  }

  const quantidadeChips = chipsItens.reduce((total, item) => total + item.quantidade, 0);
  const valorMensalEstimado = Math.round(chipsItens.reduce((total, item) => total + (item.quantidade * item.preco_por_chip), 0) * 100) / 100;
  const precoPorChip = Math.round((valorMensalEstimado / quantidadeChips) * 100) / 100;
  const notas = String(dados.notas || dados.observacoes || '').trim() || null;
  // Sem data no formulario, aproveita o retorno ja agendado no card do lead recebido.
  const retornoAgendado = linha.retorno_agendado_em
    ? formatarDateTimeSQL(parseUtcDateTime(linha.retorno_agendado_em))
    : null;
  const retorno = parseDataHoraRetorno(dados.retorno) || retornoAgendado;

  await LeadLinha.transaction(async trx => {
    let atribuicao = await LeadAtribuicao.query(trx)
      .where({ lead_linha_id: Number(linhaId), usuario_id: Number(usuarioId), etapa: 'sondagem' })
      .orderBy('id', 'desc').first();
    if (!atribuicao) {
      atribuicao = await LeadAtribuicao.query(trx).insertAndFetch({
        lead_linha_id: Number(linhaId), envio_id: linha.envio_id, usuario_id: usuarioId,
        etapa: 'sondagem', status: 'atribuido', criado_por_id: usuarioId
      });
    }

    await LeadAtribuicao.query(trx).patchAndFetchById(atribuicao.id, {
      status: 'qualificado', finalizado_em: formatarDateTimeSQL()
    });

    const sondagem = {
      lead_linha_id: Number(linhaId), atribuicao_id: atribuicao.id, usuario_id: usuarioId,
      razao_social: razaoSocial, cnpj,
      contato_nome: contatoNome, contato_tipo: contatoTipo, operadora_atual_id: operadoraAtualId,
      quantidade_chips: quantidadeChips, chips_itens: JSON.stringify(chipsItens), preco_por_chip: precoPorChip,
      valor_mensal_estimado: valorMensalEstimado, whatsapp_ddd: whatsappDdd,
      whatsapp_numero: whatsappNumero, observacoes: notas, retorno_em: retorno,
      respondido_em: formatarDateTimeSQL()
    };
    const existente = await LeadSondagem.query(trx).where('lead_linha_id', Number(linhaId)).first();
    if (existente) await LeadSondagem.query(trx).patchAndFetchById(existente.id, sondagem);
    else await LeadSondagem.query(trx).insert(sondagem);

    await trx('lead_linhas').where('id', Number(linhaId)).update({
      futuro_cliente: true, futuro_cliente_notas: notas, futuro_cliente_retorno: retorno,
      futuro_cliente_marcado_em: formatarDateTimeSQL(), futuro_cliente_marcado_por_id: usuarioId,
      retorno_agendado_em: null, retorno_agendado_por_id: null,
      etapa_atual: 'sondagem', status_operacional: 'qualificado', updated_at: new Date()
    });
  });

  await sincronizarNotificacoesRetornoLeads();

  const atualizada = await LeadLinha.query()
    .findById(linhaId)
    .withGraphFetched('[planilha, envio, atribuidoPara, sondagem.[operadoraAtual, usuario]]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'));

  const linhaFormatada = formatarLinha(atualizada);
  if (!eraFuturoCliente) {
    try {
      await telegramService.enviarFuturoCliente(linhaFormatada);
    } catch (error) {
      // A indisponibilidade do Telegram nao pode desfazer o cadastro do lead.
      console.error('Erro ao notificar futuro cliente no Telegram:', {
        message: error.response?.data?.description || error.message,
        status: error.response?.status
      });
    }
  }

  return { linha: linhaFormatada };
}

/**
 * Lista futuros clientes conforme os filtros e parametros informados.
 */
async function listarFuturosClientes(filtros = {}, usuarioId) {
  await limparFuturosClientesVencidosDaLixeira(usuarioId);

  const page = Math.max(1, Number(filtros.page || 1));
  const pageSize = Math.min(500, Math.max(1, Number(filtros.page_size || 50)));

  let query = LeadLinha.query()
    .where('futuro_cliente', true)
    .whereNull('futuro_cliente_excluido_em');
  if (usuarioId) query.where('futuro_cliente_marcado_por_id', usuarioId);

  const linhaId = Number(filtros.linha_id || 0);
  if (Number.isInteger(linhaId) && linhaId > 0) query.where('id', linhaId);

  query = aplicarBuscaFuturosClientes(query, filtros.busca);

  const total = await query.clone().resultSize();
  const linhas = await query
    .withGraphFetched('[planilha, envio, sondagem.[operadoraAtual, usuario]]')
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

async function obterMetricasFuturosClientes(filtros = {}) {
  await reconciliarVendasFuturosClientesSemOrigem();
  const usuarioResponsavel = 'COALESCE(ll.futuro_cliente_marcado_por_id, ll.retorno_agendado_por_id, ll.cliente_recusou_por_id, ll.chamada_nao_atendida_por_id)';
  // A criacao do retorno nao tem data propria; enquanto ele estiver ativo, updated_at
  // indica o momento em que o consultor o agendou.
  const dataPrimeiroContato = 'COALESCE(ll.futuro_cliente_marcado_em, ll.cliente_recusou_em, ll.chamada_nao_atendida_em, ll.updated_at)';
  const query = db('lead_linhas as ll')
    .leftJoin('lead_sondagens as ls', 'ls.lead_linha_id', 'll.id')
    .leftJoin('usuarios as u', function juntarUsuarioResponsavel() {
      this.on('u.id', '=', db.raw(usuarioResponsavel));
    })
    .where(builder => builder
      .where(subquery => subquery.where('ll.futuro_cliente', true).whereNull('ll.futuro_cliente_excluido_em'))
      .orWhereNotNull('ll.retorno_agendado_em')
      .orWhere('ll.cliente_recusou', true)
      .orWhere('ll.chamada_nao_atendida', true));
  if (filtros.usuario_id) query.whereRaw(`${usuarioResponsavel} = ?`, [Number(filtros.usuario_id)]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(filtros.data_inicio || ''))) {
    query.whereRaw(`${dataPrimeiroContato} >= ?`, [`${filtros.data_inicio} 00:00:00`]);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(filtros.data_fim || ''))) {
    query.whereRaw(`${dataPrimeiroContato} < DATE_ADD(?, INTERVAL 1 DAY)`, [filtros.data_fim]);
  }

  query
    .groupByRaw(`${usuarioResponsavel}, u.nome`)
    .select(db.raw(`${usuarioResponsavel} as usuario_id`), 'u.nome as usuario_nome')
    .count({ ligacoes_realizadas: 'll.id' })
    .sum({ qualificados: db.raw('CASE WHEN ll.futuro_cliente = true THEN 1 ELSE 0 END') })
    .sum({ retornos_agendados: db.raw('CASE WHEN ll.retorno_agendado_em IS NOT NULL THEN 1 ELSE 0 END') })
    .sum({ clientes_recusaram: db.raw('CASE WHEN ll.cliente_recusou = true THEN 1 ELSE 0 END') })
    .sum({ chamadas_nao_atendidas: db.raw('CASE WHEN ll.chamada_nao_atendida = true THEN 1 ELSE 0 END') })
    .sum({ potencial_mensal: db.raw('CASE WHEN ll.futuro_cliente = true THEN COALESCE(ls.valor_mensal_estimado, 0) ELSE 0 END') })
    .sum({ distribuidos_venda: db.raw("CASE WHEN ll.futuro_cliente = true AND ll.status_operacional IN ('distribuido_venda', 'vendido', 'perdido') THEN 1 ELSE 0 END") })
    .sum({ vendidos: db.raw("CASE WHEN ll.futuro_cliente = true AND (ll.status_operacional = 'vendido' OR ll.venda_id IS NOT NULL) THEN 1 ELSE 0 END") })
    .sum({ recusados: db.raw("CASE WHEN ll.futuro_cliente = true AND ll.status_operacional = 'perdido' THEN 1 ELSE 0 END") });

  if (filtros.agrupar_por === 'dia') {
    query
      .select(db.raw(`DATE(${dataPrimeiroContato}) as data`))
      .groupByRaw(`DATE(${dataPrimeiroContato})`)
      .orderBy('data', 'desc');
  }

  return query;
}
/** Aplica o estilo padrao das planilhas de produtividade. */
function estilizarPlanilhaProdutividade(worksheet, totalColunas) {
  worksheet.views = [{ state: 'frozen', ySplit: 4 }];
  worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: worksheet.rowCount, column: totalColunas } };
  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).font = { italic: true, color: { argb: 'FF475569' } };
  worksheet.getRow(4).height = 24;
  worksheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  worksheet.getRow(4).alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return;
    row.alignment = { vertical: 'middle' };
    if (rowNumber % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    row.eachCell(cell => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
      };
    });
  });
}

function descricaoPeriodoProdutividade(filtros = {}) {
  if (filtros.data_inicio && filtros.data_fim) {
    return filtros.data_inicio === filtros.data_fim
      ? `Data: ${filtros.data_inicio.split('-').reverse().join('/')}`
      : `Período: ${filtros.data_inicio.split('-').reverse().join('/')} a ${filtros.data_fim.split('-').reverse().join('/')}`;
  }
  if (filtros.data_inicio) return `A partir de: ${filtros.data_inicio.split('-').reverse().join('/')}`;
  if (filtros.data_fim) return `Até: ${filtros.data_fim.split('-').reverse().join('/')}`;
  return 'Período: todos os registros';
}

async function gerarXlsxProdutividadePrimeiraLigacao(filtros = {}) {
  if (filtros.data_inicio && filtros.data_fim && filtros.data_inicio > filtros.data_fim) {
    throw criarHttpError(400, 'A data inicial deve ser anterior ou igual à data final.');
  }

  const filtrosPeriodo = {
    data_inicio: filtros.data_inicio,
    data_fim: filtros.data_fim
  };
  const resumo = await obterMetricasFuturosClientes(filtrosPeriodo);
  const diario = await obterMetricasFuturosClientes({ ...filtrosPeriodo, agrupar_por: 'dia' });
  const ordenarConsultor = (a, b) => String(a.usuario_nome || '').localeCompare(String(b.usuario_nome || ''), 'pt-BR');
  const dataMetricaIso = valor => valor instanceof Date
    ? valor.toISOString().slice(0, 10)
    : String(valor || '').slice(0, 10);
  resumo.sort(ordenarConsultor);
  diario.sort((a, b) => dataMetricaIso(b.data).localeCompare(dataMetricaIso(a.data)) || ordenarConsultor(a, b));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Pos Venda';
  workbook.created = new Date();
  const periodo = descricaoPeriodoProdutividade(filtrosPeriodo);

  const wsResumo = workbook.addWorksheet('Resumo por consultor');
  wsResumo.mergeCells('A1:J1');
  wsResumo.getCell('A1').value = 'Produtividade da primeira ligação';
  wsResumo.mergeCells('A2:J2');
  wsResumo.getCell('A2').value = periodo;
  wsResumo.addRow([]);
  wsResumo.addRow(['CONSULTOR', 'LIGA\u00c7\u00d5ES FEITAS', 'RETORNOS AGENDADOS', 'CLIENTES RECUSARAM', 'CHAMADAS N\u00c3O ATENDIDAS', 'ENVIADOS PARA VENDA', 'VENDAS CONCLU\u00cdDAS', 'VENDAS RECUSADAS', 'CONVERS\u00c3O', 'POTENCIAL MENSAL']);
  resumo.forEach(item => {
    const ligacoes = Number(item.qualificados || 0);
    const vendas = Number(item.vendidos || 0);
    wsResumo.addRow([
      item.usuario_nome || 'Usuário removido',
      ligacoes,
      Number(item.retornos_agendados || 0),
      Number(item.clientes_recusaram || 0),
      Number(item.chamadas_nao_atendidas || 0),
      Number(item.distribuidos_venda || 0),
      vendas,
      Number(item.recusados || 0),
      ligacoes ? vendas / ligacoes : 0,
      Number(item.potencial_mensal || 0)
    ]);
  });
  const totais = resumo.reduce((acc, item) => ({
    ligacoes: acc.ligacoes + Number(item.qualificados || 0),
    retornos: acc.retornos + Number(item.retornos_agendados || 0),
    clientesRecusaram: acc.clientesRecusaram + Number(item.clientes_recusaram || 0),
    chamadasNaoAtendidas: acc.chamadasNaoAtendidas + Number(item.chamadas_nao_atendidas || 0),
    distribuidos: acc.distribuidos + Number(item.distribuidos_venda || 0),
    vendas: acc.vendas + Number(item.vendidos || 0),
    recusadas: acc.recusadas + Number(item.recusados || 0),
    potencial: acc.potencial + Number(item.potencial_mensal || 0)
  }), { ligacoes: 0, retornos: 0, clientesRecusaram: 0, chamadasNaoAtendidas: 0, distribuidos: 0, vendas: 0, recusadas: 0, potencial: 0 });
  const linhaTotal = wsResumo.addRow([
    'TOTAL',
    totais.ligacoes,
    totais.retornos,
    totais.clientesRecusaram,
    totais.chamadasNaoAtendidas,
    totais.distribuidos,
    totais.vendas,
    totais.recusadas,
    totais.ligacoes ? totais.vendas / totais.ligacoes : 0,
    totais.potencial
  ]);
  wsResumo.columns = [
    { width: 30 }, { width: 18 }, { width: 21 }, { width: 21 }, { width: 23 }, { width: 23 }, { width: 21 }, { width: 18 }, { width: 14 }, { width: 20 }
  ];
  wsResumo.getColumn(9).numFmt = '0.0%';
  wsResumo.getColumn(10).numFmt = 'R$ #,##0.00';
  estilizarPlanilhaProdutividade(wsResumo, 10);
  linhaTotal.font = { bold: true };
  linhaTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  const wsDiario = workbook.addWorksheet('Detalhamento diário');
  wsDiario.mergeCells('A1:K1');
  wsDiario.getCell('A1').value = 'Detalhamento diário da primeira ligação';
  wsDiario.mergeCells('A2:K2');
  wsDiario.getCell('A2').value = periodo;
  wsDiario.addRow([]);
  wsDiario.addRow(['DATA', 'CONSULTOR', 'LIGA\u00c7\u00d5ES FEITAS', 'RETORNOS AGENDADOS', 'CLIENTES RECUSARAM', 'CHAMADAS N\u00c3O ATENDIDAS', 'ENVIADOS PARA VENDA', 'VENDAS CONCLU\u00cdDAS', 'VENDAS RECUSADAS', 'CONVERS\u00c3O', 'POTENCIAL MENSAL']);
  diario.forEach(item => {
    const ligacoes = Number(item.qualificados || 0);
    const vendas = Number(item.vendidos || 0);
    const data = dataMetricaIso(item.data);
    wsDiario.addRow([
      /^\d{4}-\d{2}-\d{2}$/.test(data) ? data.split('-').reverse().join('/') : data,
      item.usuario_nome || 'Usuário removido',
      ligacoes,
      Number(item.retornos_agendados || 0),
      Number(item.clientes_recusaram || 0),
      Number(item.chamadas_nao_atendidas || 0),
      Number(item.distribuidos_venda || 0),
      vendas,
      Number(item.recusados || 0),
      ligacoes ? vendas / ligacoes : 0,
      Number(item.potencial_mensal || 0)
    ]);
  });
  wsDiario.columns = [
    { width: 14 }, { width: 30 }, { width: 18 }, { width: 21 }, { width: 21 }, { width: 23 }, { width: 23 }, { width: 21 }, { width: 18 }, { width: 14 }, { width: 20 }
  ];
  wsDiario.getColumn(10).numFmt = '0.0%';
  wsDiario.getColumn(11).numFmt = 'R$ #,##0.00';
  estilizarPlanilhaProdutividade(wsDiario, 11);
  const sufixo = filtros.data_inicio || filtros.data_fim
    ? `${filtros.data_inicio || 'inicio'}-a-${filtros.data_fim || 'hoje'}`
    : 'todo-periodo';
  return {
    buffer: await workbook.xlsx.writeBuffer(),
    nome: `produtividade-primeira-ligacao-${sufixo}.xlsx`
  };
}

function extrairCnpjsLinha(linha) {
  const dados = parseJson(linha?.dados_json, {});
  return Object.entries(dados).reduce((acc, [chave, valor]) => {
    const nome = String(chave || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!nome.includes('cnpj') && !nome.includes('documento')) return acc;
    // Linhas importadas antes da correcao podem estar sem os zeros a esquerda.
    const digitos = restaurarZerosCnpj(valor);
    if (digitos) acc.add(digitos);
    return acc;
  }, new Set());
}

async function reconciliarVendasFuturosClientesSemOrigem() {
  const vendas = await db('vendas')
    .whereNull('origem_lead_linha_id')
    .whereNull('excluido_em')
    .whereNotNull('cnpj')
    .select('id', 'cliente_id', 'cnpj', 'vendedora_id', 'criado_por_id', 'created_at')
    .orderBy('id', 'desc')
    .limit(500);
  if (!vendas.length) return 0;

  const linhas = await db('lead_linhas')
    .where('futuro_cliente', true)
    .whereNull('futuro_cliente_excluido_em')
    .whereNull('venda_id')
    .select('id', 'dados_json', 'atribuido_para_id', 'futuro_cliente_marcado_por_id', 'futuro_cliente_marcado_em');
  const index = new Map();
  linhas.forEach(linha => extrairCnpjsLinha(linha).forEach(cnpj => {
    const lista = index.get(cnpj) || [];
    lista.push(linha);
    index.set(cnpj, lista);
  }));

  let total = 0;
  for (const venda of vendas) {
    const cnpj = String(venda.cnpj || '').replace(/\D/g, '');
    const candidatos = (index.get(cnpj) || []).filter(linha => {
      const vendedorCorresponde = Number(linha.atribuido_para_id) === Number(venda.vendedora_id)
        || Number(linha.atribuido_para_id) === Number(venda.criado_por_id);
      return vendedorCorresponde && (!linha.futuro_cliente_marcado_em || !venda.created_at
        || new Date(linha.futuro_cliente_marcado_em) <= new Date(venda.created_at));
    });
    if (candidatos.length !== 1) continue;
    const linha = candidatos[0];
    await db.transaction(async trx => {
      await trx('vendas').where('id', venda.id).whereNull('origem_lead_linha_id').update({
        origem_lead_linha_id: linha.id,
        origem_sondador_id: linha.futuro_cliente_marcado_por_id
      });
      await trx('lead_linhas').where('id', linha.id).whereNull('venda_id').update({
        venda_id: venda.id,
        cliente_id: venda.cliente_id || null,
        etapa_atual: 'venda',
        status_operacional: 'vendido',
        updated_at: new Date()
      });
      if (venda.cliente_id) {
        await trx('clientes').where('id', venda.cliente_id).update({
          origem_lead_linha_id: linha.id,
          origem_sondador_id: linha.futuro_cliente_marcado_por_id,
          updated_at: new Date()
        });
      }
      await trx('lead_atribuicoes')
        .where({ lead_linha_id: linha.id, etapa: 'venda' })
        .orderBy('id', 'desc').limit(1)
        .update({ status: 'vendido', finalizado_em: venda.created_at || new Date(), updated_at: new Date() });
    });
    total += 1;
    index.delete(cnpj);
  }
  return total;
}

async function vincularVendaAoLead(linhaId, vendaId, usuarioId) {
  const venda = await db('vendas').where('id', Number(vendaId)).first();
  if (!venda) throw criarHttpError(404, 'Venda nao encontrada.');
  if (Number(venda.criado_por_id) !== Number(usuarioId) && Number(venda.vendedora_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Voce nao pode vincular esta venda ao lead.');
  }
  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  await LeadLinha.transaction(async trx => {
    await LeadLinha.query(trx).patchAndFetchById(linha.id, {
      venda_id: Number(vendaId), cliente_id: venda.cliente_id || null,
      venda_recusada_motivo: null, venda_recusada_em: null, venda_recusada_por_id: null,
      etapa_atual: 'venda', status_operacional: 'vendido'
    });
    const atribuicao = await LeadAtribuicao.query(trx)
      .where({ lead_linha_id: linha.id, usuario_id: usuarioId, etapa: 'venda' })
      .orderBy('id', 'desc').first();
    if (atribuicao) {
      await LeadAtribuicao.query(trx).patchAndFetchById(atribuicao.id, {
        status: 'vendido', finalizado_em: formatarDateTimeSQL()
      });
    }
  });
  return { linha_id: Number(linhaId), venda_id: Number(vendaId), cliente_id: venda.cliente_id || null };
}

async function marcarVendaRecusadaLead(linhaId, usuarioId, dados = {}) {
  const motivo = String(dados.motivo || dados.venda_recusada_motivo || '').trim();
  if (!motivo) throw criarHttpError(400, 'Informe o motivo da venda recusada.');
  if (motivo.length > 1000) throw criarHttpError(400, 'O motivo da venda recusada deve ter no maximo 1000 caracteres.');

  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (!linha.futuro_cliente || linha.futuro_cliente_excluido_em) {
    throw criarHttpError(400, 'Somente futuros clientes ativos podem ter venda recusada.');
  }
  if (linha.venda_id || linha.status_operacional === 'vendido') {
    throw criarHttpError(409, 'Este futuro cliente ja possui venda registrada.');
  }

  await LeadLinha.transaction(async trx => {
    const recusadaEm = formatarDateTimeSQL();
    await LeadLinha.query(trx).patchAndFetchById(linha.id, {
      venda_recusada_motivo: motivo,
      venda_recusada_em: recusadaEm,
      venda_recusada_por_id: usuarioId,
      etapa_atual: 'venda',
      status_operacional: 'perdido'
    });

    let atribuicao = await LeadAtribuicao.query(trx)
      .where({ lead_linha_id: linha.id, usuario_id: usuarioId, etapa: 'venda' })
      .orderBy('id', 'desc').first();
    if (!atribuicao) {
      atribuicao = await LeadAtribuicao.query(trx).insertAndFetch({
        lead_linha_id: linha.id,
        envio_id: linha.envio_id,
        usuario_id: usuarioId,
        etapa: 'venda',
        status: 'atribuido',
        criado_por_id: usuarioId
      });
    }
    await LeadAtribuicao.query(trx).patchAndFetchById(atribuicao.id, {
      status: 'perdido', motivo_resultado: motivo, finalizado_em: recusadaEm
    });
  });

  const atualizada = await LeadLinha.query()
    .findById(linha.id)
    .withGraphFetched('[planilha, envio, atribuidoPara, sondagem.[operadoraAtual, usuario]]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'));

  return { linha: formatarLinha(atualizada) };
}

/**
 * Busca a linha e recarrega com os relacionamentos usados pelo frontend.
 */
async function buscarLinhaFormatada(linhaId) {
  const atualizada = await LeadLinha.query()
    .findById(Number(linhaId))
    .withGraphFetched('[planilha, envio, atribuidoPara, sondagem.[operadoraAtual, usuario]]')
    .modifyGraph('atribuidoPara', builder => builder.select('id', 'nome', 'email'));

  return { linha: formatarLinha(atualizada) };
}

/**
 * Registra que o cliente recusou o contato na primeira ligacao.
 */
async function marcarClienteRecusouLead(linhaId, usuarioId, dados = {}) {
  const motivo = String(dados.motivo || dados.cliente_recusou_motivo || '').trim();
  if (motivo.length > 1000) throw criarHttpError(400, 'O motivo da recusa deve ter no maximo 1000 caracteres.');

  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (linha.venda_id || linha.status_operacional === 'vendido') {
    throw criarHttpError(409, 'Este lead ja possui venda registrada.');
  }
  if (linha.cliente_recusou) {
    throw criarHttpError(409, 'Este lead ja foi marcado como recusado pelo cliente.');
  }

  const recusadoEm = formatarDateTimeSQL();

  await LeadLinha.transaction(async trx => {
    await LeadLinha.query(trx).patchAndFetchById(linha.id, {
      cliente_recusou: true,
      cliente_recusou_motivo: motivo || null,
      cliente_recusou_em: recusadoEm,
      cliente_recusou_por_id: usuarioId,
      retorno_agendado_em: null,
      retorno_agendado_por_id: null,
      status_operacional: 'perdido'
    });

    let atribuicao = await LeadAtribuicao.query(trx)
      .where({ lead_linha_id: linha.id, usuario_id: usuarioId, etapa: 'sondagem' })
      .orderBy('id', 'desc').first();
    if (!atribuicao) {
      atribuicao = await LeadAtribuicao.query(trx).insertAndFetch({
        lead_linha_id: linha.id,
        envio_id: linha.envio_id,
        usuario_id: usuarioId,
        etapa: 'sondagem',
        status: 'atribuido',
        criado_por_id: usuarioId
      });
    }
    await LeadAtribuicao.query(trx).patchAndFetchById(atribuicao.id, {
      status: 'perdido', motivo_resultado: motivo || null, finalizado_em: recusadoEm
    });
  });

  await sincronizarNotificacoesRetornoLeads();

  return buscarLinhaFormatada(linha.id);
}

/**
 * Reverte a recusa do cliente e devolve o lead para a fila de trabalho.
 */
async function reverterClienteRecusouLead(linhaId, usuarioId) {
  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (!linha.cliente_recusou) {
    throw criarHttpError(400, 'Este lead nao esta marcado como recusado pelo cliente.');
  }

  await LeadLinha.transaction(async trx => {
    await LeadLinha.query(trx).patchAndFetchById(linha.id, {
      cliente_recusou: false,
      cliente_recusou_motivo: null,
      cliente_recusou_em: null,
      cliente_recusou_por_id: null,
      status_operacional: linha.futuro_cliente ? 'qualificado' : 'pendente'
    });

    const atribuicao = await LeadAtribuicao.query(trx)
      .where({ lead_linha_id: linha.id, usuario_id: usuarioId, etapa: 'sondagem' })
      .orderBy('id', 'desc').first();
    if (atribuicao && atribuicao.status === 'perdido') {
      await LeadAtribuicao.query(trx).patchAndFetchById(atribuicao.id, {
        status: linha.futuro_cliente ? 'qualificado' : 'atribuido',
        motivo_resultado: null,
        finalizado_em: null
      });
    }
  });

  return buscarLinhaFormatada(linha.id);
}

/**
 * Registra que a ligacao nao foi atendida (motivo opcional). Nao tira o lead da fila.
 */
async function marcarChamadaNaoAtendidaLead(linhaId, usuarioId, dados = {}) {
  const motivo = String(dados.motivo || dados.chamada_nao_atendida_motivo || '').trim();
  if (motivo.length > 1000) throw criarHttpError(400, 'O motivo deve ter no maximo 1000 caracteres.');

  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (linha.chamada_nao_atendida) {
    throw criarHttpError(409, 'Este lead ja foi marcado como chamada nao atendida.');
  }

  await LeadLinha.query().patchAndFetchById(linha.id, {
    chamada_nao_atendida: true,
    chamada_nao_atendida_motivo: motivo || null,
    chamada_nao_atendida_em: formatarDateTimeSQL(),
    chamada_nao_atendida_por_id: usuarioId
  });

  return buscarLinhaFormatada(linha.id);
}

/**
 * Reverte a marcacao de chamada nao atendida.
 */
async function reverterChamadaNaoAtendidaLead(linhaId, usuarioId) {
  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (!linha.chamada_nao_atendida) {
    throw criarHttpError(400, 'Este lead nao esta marcado como chamada nao atendida.');
  }

  await LeadLinha.query().patchAndFetchById(linha.id, {
    chamada_nao_atendida: false,
    chamada_nao_atendida_motivo: null,
    chamada_nao_atendida_em: null,
    chamada_nao_atendida_por_id: null
  });

  return buscarLinhaFormatada(linha.id);
}

/**
 * Agenda (ou limpa) a data e hora de retorno de um lead recebido.
 */
async function marcarRetornoLead(linhaId, usuarioId, dados = {}) {
  const linha = await LeadLinha.query().findById(Number(linhaId));
  if (!linha || Number(linha.atribuido_para_id) !== Number(usuarioId)) {
    throw criarHttpError(403, 'Lead nao encontrado ou atribuido a outro usuario.');
  }
  if (linha.cliente_recusou) {
    throw criarHttpError(409, 'Este lead foi recusado pelo cliente e nao pode ter retorno marcado.');
  }

  const retorno = parseDataHoraRetorno(dados.retorno);

  await LeadLinha.query().patchAndFetchById(linha.id, {
    retorno_agendado_em: retorno,
    retorno_agendado_por_id: retorno ? usuarioId : null
  });

  await sincronizarNotificacoesRetornoLeads();

  return buscarLinhaFormatada(linha.id);
}

/**
 * Atualiza as notificacoes de "ligacoes marcadas" sem derrubar a requisicao em caso de falha.
 */
async function sincronizarNotificacoesRetornoLeads() {
  try {
    await require('./notificacao.service').sincronizarRetornosLeads();
  } catch (error) {
    console.error('Erro ao sincronizar notificacoes de retorno de leads:', error);
  }
}

/**
 * Limpa futuros clientes vencidos da lixeira e restaura o estado inicial.
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
 * Lista futuros clientes lixeira conforme os filtros e parametros informados.
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
 * Envia futuro cliente para lixeira para processamento.
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
 * Restaura futuro cliente quando a regra de negocio permite.
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
 * Exclui futuro cliente definitivo conforme a regra de negocio.
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
  importarExcel,
  importarBaseAntigaArquivo,
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
  obterMetricasFuturosClientes,
  gerarXlsxProdutividadePrimeiraLigacao,
  vincularVendaAoLead,
  marcarVendaRecusadaLead,
  marcarClienteRecusouLead,
  reverterClienteRecusouLead,
  marcarChamadaNaoAtendidaLead,
  reverterChamadaNaoAtendidaLead,
  marcarRetornoLead,
  listarFuturosClientesLixeira,
  enviarFuturoClienteParaLixeira,
  restaurarFuturoCliente,
  excluirFuturoClienteDefinitivo,
  _internals: {
    montarColecoesExcel,
    montarColecaoCsv,
    extrairCnpjsLinha
  }
};
