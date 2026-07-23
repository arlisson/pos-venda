/**
 * Servico de notas vinculadas a entidades do sistema.
 */
const db = require('../database/connection');
const { parseUtcDateTime } = require('../utils/datetime');
const clienteService = require('./cliente.service');
const clienteSecretoService = require('./cliente-secreto.service');
const vendaService = require('./venda.service');
const notificacaoService = require('./notificacao.service');

const TIPOS_VALIDOS = ['cliente', 'lead', 'venda'];

/**
 * Valida tipo e retorna o resultado esperado.
 */
function validarTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error('Tipo de entidade inválido.');
  }
}

/**
 * Formata date time sql para exibicao ou envio.
 */
function formatarDateTimeSQL(data = new Date()) {
  /**
   * Preenche valores numericos com zero a esquerda.
   */
  const pad = (value) => String(value).padStart(2, '0');

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

  const data = parseUtcDateTime(valor);

  if (!data) {
    throw new Error('Data e hora de retorno invalidas.');
  }

  return formatarDateTimeSQL(data);
}

/**
 * Formata nota para exibicao ou envio.
 */
function formatarNota(nota) {
  if (!nota) return null;

  return {
    id: nota.id,
    entidade_tipo: nota.entidade_tipo,
    entidade_id: nota.entidade_id,
    usuario_id: nota.usuario_id,
    titulo: nota.titulo || '',
    conteudo: nota.conteudo || '',
    retorno_agendado_para: nota.retorno_agendado_para || null,
    created_at: nota.created_at,
    updated_at: nota.updated_at
  };
}

/**
 * Verifica se usuario pode acessar entidade atende a condicao esperada.
 */
async function usuarioPodeAcessarEntidade(tipo, entidadeId, usuarioId) {
  validarTipo(tipo);

  if (tipo === 'cliente') {
    return clienteService.usuarioPodeAcessarCliente(entidadeId, usuarioId);
  }

  if (tipo === 'lead') {
    const lead = await clienteSecretoService.buscarClienteSecretoPorId(entidadeId, usuarioId);
    return Boolean(lead);
  }

  const venda = await vendaService.buscarVendaPorId(entidadeId, usuarioId);
  return Boolean(venda);
}

/**
 * Monta payload a partir dos dados informados.
 */
function montarPayload(dados = {}) {
  const titulo = String(dados.titulo || '').trim().slice(0, 160);
  const conteudo = String(dados.conteudo || '').trim();
  const payload = {
    titulo: titulo || null,
    conteudo: conteudo || null
  };

  if (!titulo && !conteudo) {
    throw new Error('Informe um título ou conteúdo para a nota.');
  }

  if (Object.prototype.hasOwnProperty.call(dados, 'retorno_agendado_para')) {
    payload.retorno_agendado_para = parseDataHoraRetorno(dados.retorno_agendado_para);
  }

  return payload;
}

/**
 * Lista notas conforme os filtros e parametros informados.
 */
async function listarNotas(tipo, entidadeId, usuarioId) {
  validarTipo(tipo);

  const permitido = await usuarioPodeAcessarEntidade(tipo, entidadeId, usuarioId);
  if (!permitido) return null;

  const notas = await db('entidade_notas')
    .where({
      entidade_tipo: tipo,
      entidade_id: Number(entidadeId),
      usuario_id: Number(usuarioId)
    })
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc');

  return notas.map(formatarNota);
}

/**
 * Cria nota com os dados informados.
 */
async function criarNota(tipo, entidadeId, usuarioId, dados) {
  validarTipo(tipo);

  const permitido = await usuarioPodeAcessarEntidade(tipo, entidadeId, usuarioId);
  if (!permitido) return null;

  const agora = formatarDateTimeSQL();
  const payload = montarPayload(dados);
  const [id] = await db('entidade_notas').insert({
    entidade_tipo: tipo,
    entidade_id: Number(entidadeId),
    usuario_id: Number(usuarioId),
    retorno_agendado_para: null,
    ...payload,
    created_at: agora,
    updated_at: agora
  });

  return formatarNota(await db('entidade_notas').where({ id }).first());
}

/**
 * Atualiza nota com os dados informados.
 */
async function atualizarNota(notaId, usuarioId, dados) {
  const nota = await db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .first();

  if (!nota) return null;

  const payload = montarPayload(dados);
  const retornoAlterado = Object.prototype.hasOwnProperty.call(payload, 'retorno_agendado_para')
    && String(payload.retorno_agendado_para || '') !== String(nota.retorno_agendado_para || '');

  await db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .update({
      ...payload,
      updated_at: formatarDateTimeSQL()
    });

  if (retornoAlterado) {
    await notificacaoService.desativarNotificacoesRetornoNota(notaId);
  }

  return formatarNota(await db('entidade_notas').where({ id: Number(notaId) }).first());
}

/**
 * Exclui nota conforme a regra de negocio.
 */
async function excluirNota(notaId, usuarioId) {
  const total = await db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .delete();

  if (total) {
    await notificacaoService.desativarNotificacoesRetornoNota(notaId);
  }

  return total;
}

module.exports = {
  listarNotas,
  criarNota,
  atualizarNota,
  excluirNota
};
