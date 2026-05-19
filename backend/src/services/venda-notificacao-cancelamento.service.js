const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const Venda = require('../models/Venda');
const notificacaoEmailService = require('./notificacao-email.service');

const TIPO_NOTIFICACAO = 'venda_cancelada';
const PERMISSAO_RECEBER = 'notificacoes_venda_cancelada';
const PERMISSAO_RECEBER_TODAS = 'notificacoes_receber_todas';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);

      if (Array.isArray(parsed)) return parsed;

      return Object.entries(parsed)
        .filter(([, permitido]) => permitido === true)
        .map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

function usuarioPodeReceber(usuario) {
  if (!usuario || !usuario.ativo) return false;
  if (usuario.role?.nome === 'admin') return true;

  const chaves = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return chaves.includes(PERMISSAO_RECEBER) || chaves.includes(PERMISSAO_RECEBER_TODAS);
}

function sourceKeyVenda(vendaId) {
  return `venda_cancelada:${vendaId}`;
}

function nomeVenda(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

async function listarDestinatarios(usuarioDisparadorId) {
  const usuarios = await Usuario.query()
    .withGraphFetched('role')
    .where('ativo', true);

  const ids = new Set();

  usuarios.forEach(usuario => {
    if (usuarioPodeReceber(usuario)) {
      ids.add(Number(usuario.id));
    }
  });

  if (usuarioDisparadorId) {
    ids.delete(Number(usuarioDisparadorId));
  }

  return Array.from(ids);
}

async function criarNotificacaoCancelamento({ venda, motivo, usuarioId, trx = null }) {
  if (!venda?.id) return null;

  const destinatariosIds = await listarDestinatarios(usuarioId);

  if (destinatariosIds.length === 0) return null;

  const sourceKey = sourceKeyVenda(venda.id);
  const titulo = 'Venda cancelada';
  const mensagem = `${nomeVenda(venda)} foi cancelada: ${motivo}`;

  const payload = {
    tipo: TIPO_NOTIFICACAO,
    titulo,
    mensagem,
    nivel: 'danger',
    entidade: 'vendas',
    entidade_id: venda.id,
    source_key: sourceKey,
    dados: JSON.stringify({
      venda_id: venda.id,
      venda_nome: nomeVenda(venda),
      motivo_cancelamento: motivo,
      cancelada_em: venda.cancelada_em,
      cancelada_por_id: usuarioId
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

async function desativarNotificacaoCancelamento(vendaId, trx = null) {
  return Notificacao.query(trx)
    .where('source_key', sourceKeyVenda(vendaId))
    .patch({ ativa: false, updated_at: new Date() });
}

module.exports = {
  TIPO_NOTIFICACAO,
  PERMISSAO_RECEBER,
  criarNotificacaoCancelamento,
  desativarNotificacaoCancelamento
};
