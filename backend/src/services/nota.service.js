const db = require('../database/connection');
const clienteService = require('./cliente.service');
const vendaService = require('./venda.service');

const TIPOS_VALIDOS = ['cliente', 'venda'];

function validarTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error('Tipo de entidade inválido.');
  }
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate())
  ].join('-') + ' ' + [
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds())
  ].join(':');
}

function formatarNota(nota) {
  if (!nota) return null;

  return {
    id: nota.id,
    entidade_tipo: nota.entidade_tipo,
    entidade_id: nota.entidade_id,
    usuario_id: nota.usuario_id,
    titulo: nota.titulo || '',
    conteudo: nota.conteudo || '',
    created_at: nota.created_at,
    updated_at: nota.updated_at
  };
}

async function usuarioPodeAcessarEntidade(tipo, entidadeId, usuarioId) {
  validarTipo(tipo);

  if (tipo === 'cliente') {
    return clienteService.usuarioPodeAcessarCliente(entidadeId, usuarioId);
  }

  const venda = await vendaService.buscarVendaPorId(entidadeId, usuarioId);
  return Boolean(venda);
}

function montarPayload(dados = {}) {
  const titulo = String(dados.titulo || '').trim().slice(0, 160);
  const conteudo = String(dados.conteudo || '').trim();

  if (!titulo && !conteudo) {
    throw new Error('Informe um título ou conteúdo para a nota.');
  }

  return {
    titulo: titulo || null,
    conteudo: conteudo || null
  };
}

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
    ...payload,
    created_at: agora,
    updated_at: agora
  });

  return formatarNota(await db('entidade_notas').where({ id }).first());
}

async function atualizarNota(notaId, usuarioId, dados) {
  const nota = await db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .first();

  if (!nota) return null;

  const payload = montarPayload(dados);
  await db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .update({
      ...payload,
      updated_at: formatarDateTimeSQL()
    });

  return formatarNota(await db('entidade_notas').where({ id: Number(notaId) }).first());
}

async function excluirNota(notaId, usuarioId) {
  return db('entidade_notas')
    .where({ id: Number(notaId), usuario_id: Number(usuarioId) })
    .delete();
}

module.exports = {
  listarNotas,
  criarNota,
  atualizarNota,
  excluirNota
};
