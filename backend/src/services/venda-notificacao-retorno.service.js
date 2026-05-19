const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Venda = require('../models/Venda');
const notificacaoEmailService = require('./notificacao-email.service');
const notificacaoService = require('./notificacao.service');

const TIPO_NOTIFICACAO = 'venda_retorno_registrado';

function sourceKeyVenda(vendaId) {
  return `venda_retorno:${vendaId}`;
}

function nomeVenda(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

async function listarDestinatariosVenda(vendaId, trx = null) {
  const knex = Venda.knex();
  const builder = knex('venda_vendedoras')
    .where('venda_id', vendaId)
    .select('usuario_id');

  if (trx) builder.transacting(trx);

  const vinculos = await builder;
  const ids = vinculos.map(item => Number(item.usuario_id)).filter(Boolean);

  if (ids.length > 0) return ids;

  const venda = await Venda.query(trx).findById(vendaId).select('vendedora_id');

  return venda?.vendedora_id ? [Number(venda.vendedora_id)] : [];
}

async function criarOuAtualizarNotificacaoRetorno({ venda, statusAnterior, motivo, usuarioId, trx = null }) {
  if (!venda?.id) return null;

  const todosDestinatarios = await listarDestinatariosVenda(venda.id, trx);
  const semDisparador = todosDestinatarios.filter(id => Number(id) !== Number(usuarioId));
  const baseDestinatarios = semDisparador.length > 0 ? semDisparador : todosDestinatarios;
  const adminsIds = await notificacaoService.listarAdminsAtivos(trx);
  const destinatariosIds = Array.from(new Set([
    ...baseDestinatarios.map(Number).filter(Boolean),
    ...adminsIds
  ]));

  if (destinatariosIds.length === 0) return null;

  const sourceKey = sourceKeyVenda(venda.id);
  const titulo = 'Venda retornou para correção';
  const mensagem = `${nomeVenda(venda)} foi retornada pelo pos-venda: ${motivo}`;

  const payload = {
    tipo: TIPO_NOTIFICACAO,
    titulo,
    mensagem,
    nivel: 'warn',
    entidade: 'vendas',
    entidade_id: venda.id,
    source_key: sourceKey,
    dados: JSON.stringify({
      venda_id: venda.id,
      venda_nome: nomeVenda(venda),
      motivo_retorno: motivo,
      status_anterior: statusAnterior,
      retornou_em: venda.retornou_em
    }),
    ativa: true,
    updated_at: new Date()
  };

  const existente = await Notificacao.query(trx).where('source_key', sourceKey).first();
  const notificacao = existente
    ? await Notificacao.query(trx).patchAndFetchById(existente.id, payload)
    : await Notificacao.query(trx).insertAndFetch(payload);

  const destinatariosAtuais = await NotificacaoDestinatario.query(trx)
    .where('notificacao_id', notificacao.id)
    .select('id', 'usuario_id');

  const idsDesejados = new Set(destinatariosIds.map(Number));
  const sobrando = destinatariosAtuais.filter(item => !idsDesejados.has(Number(item.usuario_id)));

  if (sobrando.length > 0) {
    await NotificacaoDestinatario.query(trx)
      .whereIn('id', sobrando.map(item => item.id))
      .delete();
  }

  const existentes = new Set(
    destinatariosAtuais
      .filter(item => idsDesejados.has(Number(item.usuario_id)))
      .map(item => Number(item.usuario_id))
  );

  for (const usuarioDestId of destinatariosIds) {
    if (!existentes.has(Number(usuarioDestId))) {
      await NotificacaoDestinatario.query(trx).insert({
        notificacao_id: notificacao.id,
        usuario_id: usuarioDestId
      });
    }
  }

  await NotificacaoDestinatario.query(trx)
    .where('notificacao_id', notificacao.id)
    .patch({
      lida_em: null,
      popup_visto_em: null,
      email_enviado_em: null,
      email_erro: null
    });

  notificacaoEmailService.enviarEmailsPendentesAsync(notificacao.id);

  return notificacao;
}

async function desativarNotificacaoRetorno(vendaId, trx = null) {
  return Notificacao.query(trx)
    .where('source_key', sourceKeyVenda(vendaId))
    .patch({ ativa: false, updated_at: new Date() });
}

module.exports = {
  TIPO_NOTIFICACAO,
  criarOuAtualizarNotificacaoRetorno,
  desativarNotificacaoRetorno
};
