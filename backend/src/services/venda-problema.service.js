const db = require('../database/connection');
const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const Venda = require('../models/Venda');
const VendaHistorico = require('../models/VendaHistorico');
const VendaProblema = require('../models/VendaProblema');
const VendaProblemaDestinatario = require('../models/VendaProblemaDestinatario');
const VendaProblemaEvento = require('../models/VendaProblemaEvento');

const STATUS_ATIVOS = ['aberto', 'resolvido', 'correcao_solicitada'];
const TIPOS_NOTIFICACAO_PROBLEMA = [
  'venda_problema_aberto',
  'venda_problema_resolvido',
  'venda_problema_correcao'
];

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      if (Array.isArray(parsed)) return parsed;
      return Object.entries(parsed).filter(([, valor]) => valor === true).map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes).filter(([, valor]) => valor === true).map(([chave]) => chave);
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = valor => String(valor).padStart(2, '0');

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

function erro(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function buscarUsuario(usuarioId) {
  return Usuario.query().findById(usuarioId).withGraphFetched('role');
}

function usuarioPodeVerTodas(usuario) {
  if (usuario?.role?.nome === 'admin') return true;

  return [
    ...parsePermissoes(usuario?.permissoes),
    ...parsePermissoes(usuario?.role?.permissoes)
  ].includes('vendas_ver_todas');
}

async function buscarVendaAcessivel(vendaId, usuarioId, trx = null) {
  const usuario = await buscarUsuario(usuarioId);
  const venda = await Venda.query(trx)
    .findById(vendaId)
    .whereNull('excluido_em')
    .withGraphFetched('[vendedora, vendedoras, cliente]');

  if (!venda) return null;
  if (usuarioPodeVerTodas(usuario)) return venda;

  const vinculado = Number(venda.criado_por_id) === Number(usuarioId)
    || Number(venda.vendedora_id) === Number(usuarioId)
    || (venda.vendedoras || []).some(item => Number(item.id) === Number(usuarioId));

  return vinculado ? venda : null;
}

function nomeVenda(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

async function buscarProblemaCompleto(problemaId, trx = null) {
  return VendaProblema.query(trx)
    .findById(problemaId)
    .withGraphFetched('[venda.[cliente, vendedora, vendedoras], solicitante, destinatarios.usuario, eventos.usuario]')
    .modifyGraph('eventos', builder => builder.orderBy('created_at', 'asc').orderBy('id', 'asc'));
}

async function buscarProblemaAtivo(vendaId, trx = null) {
  const problema = await VendaProblema.query(trx)
    .where('venda_id', vendaId)
    .whereIn('status', STATUS_ATIVOS)
    .orderBy('id', 'desc')
    .first();

  return problema ? buscarProblemaCompleto(problema.id, trx) : null;
}

async function listarProblemasAtivos(vendaId, trx = null) {
  return VendaProblema.query(trx)
    .where('venda_id', vendaId)
    .whereIn('status', STATUS_ATIVOS)
    .withGraphFetched('[venda.[cliente, vendedora, vendedoras], solicitante, destinatarios.usuario, eventos.usuario]')
    .modifyGraph('eventos', builder => builder.orderBy('created_at', 'asc').orderBy('id', 'asc'))
    .orderBy('updated_at', 'desc')
    .orderBy('id', 'desc');
}

async function registrarEvento({ problemaId, usuarioId, tipo, mensagem, dados = {}, trx }) {
  return VendaProblemaEvento.query(trx).insertAndFetch({
    problema_id: Number(problemaId),
    usuario_id: usuarioId ? Number(usuarioId) : null,
    tipo,
    mensagem,
    dados: JSON.stringify(dados)
  });
}

async function registrarHistoricoVenda({ vendaId, usuarioId, acao, observacao, dados = {}, trx }) {
  return VendaHistorico.query(trx).insert({
    venda_id: Number(vendaId),
    usuario_id: usuarioId ? Number(usuarioId) : null,
    acao,
    observacao,
    dados: JSON.stringify(dados),
    created_at: formatarDateTimeSQL()
  });
}

async function criarNotificacaoProblema({ tipo, problema, evento, destinatariosIds, titulo, mensagem, nivel = 'danger', trx }) {
  const sourceKey = `venda_problema:${tipo}:${problema.id}:${evento.id}`;
  const notificacao = await Notificacao.query(trx).insertAndFetch({
    tipo,
    titulo,
    mensagem,
    nivel,
    entidade: 'vendas',
    entidade_id: problema.venda_id,
    source_key: sourceKey,
    dados: JSON.stringify({
      problema_id: problema.id,
      venda_id: problema.venda_id,
      venda_nome: nomeVenda(problema.venda),
      solicitante_id: problema.solicitante_id,
      evento_id: evento.id,
      evento_tipo: evento.tipo,
      mensagem: evento.mensagem
    }),
    ativa: true,
    updated_at: new Date()
  });

  for (const usuarioId of [...new Set(destinatariosIds.map(Number).filter(Boolean))]) {
    await NotificacaoDestinatario.query(trx).insert({
      notificacao_id: notificacao.id,
      usuario_id: usuarioId
    });
  }

  return notificacao;
}

async function resolverDestinatarios(venda, dados, trx) {
  if (dados.modo_destinatario === 'manual') {
    const ids = [...new Set((dados.destinatarios || []).map(Number).filter(Boolean))];

    if (ids.length === 0) {
      throw erro(400, 'Selecione ao menos um responsavel.');
    }

    const usuarios = await Usuario.query(trx)
      .whereIn('id', ids)
      .where('ativo', true)
      .select('id');

    if (usuarios.length !== ids.length) {
      throw erro(400, 'Um ou mais responsaveis selecionados nao estao ativos.');
    }

    return ids;
  }

  const vinculados = (venda.vendedoras || []).map(item => Number(item.id)).filter(Boolean);
  const fallback = venda.vendedora_id ? [Number(venda.vendedora_id)] : [];
  const ids = [...new Set(vinculados.length > 0 ? vinculados : fallback)];

  if (ids.length === 0) {
    throw erro(400, 'A venda nao possui responsavel vinculado.');
  }

  return ids;
}

async function abrirProblema(vendaId, dados, usuarioId) {
  const motivo = String(dados.motivo || '').trim();

  if (!motivo) {
    throw erro(400, 'Informe o motivo do problema.');
  }

  return VendaProblema.transaction(async trx => {
    const venda = await buscarVendaAcessivel(vendaId, usuarioId, trx);

    if (!venda) {
      throw erro(404, 'Venda nao encontrada.');
    }

    const destinatariosIds = await resolverDestinatarios(venda, dados, trx);
    const problema = await VendaProblema.query(trx).insertAndFetch({
      venda_id: venda.id,
      solicitante_id: usuarioId,
      status: 'aberto',
      aberto_em: formatarDateTimeSQL()
    });

    for (const responsavelId of destinatariosIds) {
      await VendaProblemaDestinatario.query(trx).insert({
        problema_id: problema.id,
        usuario_id: responsavelId
      });
    }

    const evento = await registrarEvento({
      problemaId: problema.id,
      usuarioId,
      tipo: 'abertura',
      mensagem: motivo,
      dados: { destinatarios: destinatariosIds },
      trx
    });

    const completo = await buscarProblemaCompleto(problema.id, trx);

    await criarNotificacaoProblema({
      tipo: 'venda_problema_aberto',
      problema: completo,
      evento,
      destinatariosIds,
      titulo: 'Venda marcada com problema',
      mensagem: `${nomeVenda(venda)} foi marcada com problema: ${motivo}`,
      trx
    });

    await registrarHistoricoVenda({
      vendaId: venda.id,
      usuarioId,
      acao: 'venda.problema_aberto',
      observacao: motivo,
      dados: { problema_id: problema.id, destinatarios: destinatariosIds },
      trx
    });

    return buscarProblemaCompleto(problema.id, trx);
  });
}

async function obterAtivo(vendaId, usuarioId) {
  const venda = await buscarVendaAcessivel(vendaId, usuarioId);

  if (!venda) {
    return null;
  }

  return buscarProblemaAtivo(venda.id);
}

async function listarAtivos(vendaId, usuarioId) {
  const venda = await buscarVendaAcessivel(vendaId, usuarioId);

  if (!venda) {
    return [];
  }

  return listarProblemasAtivos(venda.id);
}

function usuarioEhResponsavel(problema, usuarioId) {
  return (problema.destinatarios || []).some(item => Number(item.usuario_id) === Number(usuarioId));
}

async function resolverProblema(problemaId, dados, usuarioId) {
  const mensagem = String(dados.mensagem || '').trim();

  if (!mensagem) {
    throw erro(400, 'Informe a mensagem de resolucao.');
  }

  return VendaProblema.transaction(async trx => {
    const problema = await buscarProblemaCompleto(problemaId, trx);

    if (!problema || !STATUS_ATIVOS.includes(problema.status)) {
      throw erro(404, 'Problema ativo nao encontrado.');
    }

    if (!usuarioEhResponsavel(problema, usuarioId)) {
      throw erro(403, 'Apenas responsaveis podem marcar o problema como resolvido.');
    }

    const agora = formatarDateTimeSQL();
    await VendaProblema.query(trx).patchAndFetchById(problema.id, {
      status: 'resolvido',
      resolvido_em: agora,
      updated_at: agora
    });

    await VendaProblemaDestinatario.query(trx)
      .where('problema_id', problema.id)
      .where('usuario_id', usuarioId)
      .patch({ resolvido_em: agora, updated_at: agora });

    const evento = await registrarEvento({
      problemaId: problema.id,
      usuarioId,
      tipo: 'resolucao',
      mensagem,
      trx
    });
    const atualizado = await buscarProblemaCompleto(problema.id, trx);

    await criarNotificacaoProblema({
      tipo: 'venda_problema_resolvido',
      problema: atualizado,
      evento,
      destinatariosIds: [problema.solicitante_id],
      titulo: 'Problema de venda marcado como resolvido',
      mensagem: `${nomeVenda(problema.venda)} foi marcada como resolvida: ${mensagem}`,
      nivel: 'warn',
      trx
    });

    await registrarHistoricoVenda({
      vendaId: problema.venda_id,
      usuarioId,
      acao: 'venda.problema_resolvido',
      observacao: mensagem,
      dados: { problema_id: problema.id },
      trx
    });

    return atualizado;
  });
}

async function solicitarCorrecao(problemaId, dados, usuarioId) {
  const mensagem = String(dados.mensagem || '').trim();

  if (!mensagem) {
    throw erro(400, 'Informe a mensagem de correcao.');
  }

  return VendaProblema.transaction(async trx => {
    const problema = await buscarProblemaCompleto(problemaId, trx);

    if (!problema || !STATUS_ATIVOS.includes(problema.status)) {
      throw erro(404, 'Problema ativo nao encontrado.');
    }

    if (Number(problema.solicitante_id) !== Number(usuarioId)) {
      throw erro(403, 'Apenas o solicitante pode pedir novas correcoes.');
    }

    const agora = formatarDateTimeSQL();
    await VendaProblema.query(trx).patchAndFetchById(problema.id, {
      status: 'correcao_solicitada',
      resolvido_em: null,
      updated_at: agora
    });

    await VendaProblemaDestinatario.query(trx)
      .where('problema_id', problema.id)
      .patch({ resolvido_em: null, updated_at: agora });

    const evento = await registrarEvento({
      problemaId: problema.id,
      usuarioId,
      tipo: 'correcao',
      mensagem,
      trx
    });
    const atualizado = await buscarProblemaCompleto(problema.id, trx);
    const destinatariosIds = atualizado.destinatarios.map(item => item.usuario_id);

    await criarNotificacaoProblema({
      tipo: 'venda_problema_correcao',
      problema: atualizado,
      evento,
      destinatariosIds,
      titulo: 'Nova correcao solicitada em venda',
      mensagem: `${nomeVenda(problema.venda)} precisa de nova correcao: ${mensagem}`,
      trx
    });

    await registrarHistoricoVenda({
      vendaId: problema.venda_id,
      usuarioId,
      acao: 'venda.problema_correcao_solicitada',
      observacao: mensagem,
      dados: { problema_id: problema.id },
      trx
    });

    return atualizado;
  });
}

async function verificarProblema(problemaId, usuarioId) {
  return VendaProblema.transaction(async trx => {
    const problema = await buscarProblemaCompleto(problemaId, trx);

    if (!problema || !STATUS_ATIVOS.includes(problema.status)) {
      throw erro(404, 'Problema ativo nao encontrado.');
    }

    if (Number(problema.solicitante_id) !== Number(usuarioId)) {
      throw erro(403, 'Apenas o solicitante pode verificar o problema.');
    }

    const agora = formatarDateTimeSQL();
    await VendaProblema.query(trx).patchAndFetchById(problema.id, {
      status: 'verificado',
      verificado_em: agora,
      updated_at: agora
    });

    const evento = await registrarEvento({
      problemaId: problema.id,
      usuarioId,
      tipo: 'verificacao',
      mensagem: 'Problema verificado e fechado.',
      trx
    });

    await Notificacao.query(trx)
      .where('source_key', 'like', `venda_problema:%:${problema.id}:%`)
      .patch({ ativa: false, updated_at: new Date() });

    await registrarHistoricoVenda({
      vendaId: problema.venda_id,
      usuarioId,
      acao: 'venda.problema_verificado',
      observacao: evento.mensagem,
      dados: { problema_id: problema.id },
      trx
    });

    return buscarProblemaCompleto(problema.id, trx);
  });
}

async function usuarioTemNotificacaoProblema(usuarioId) {
  const total = await db('notificacao_destinatarios as nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .whereIn('n.tipo', TIPOS_NOTIFICACAO_PROBLEMA)
    .count('nd.id as total')
    .first();

  return Number(total?.total || 0) > 0;
}

async function listarDestinatariosDisponiveis() {
  return Usuario.query()
    .withGraphFetched('role')
    .where('ativo', true)
    .orderBy('nome', 'asc')
    .select('id', 'nome', 'email', 'role_id', 'foto_perfil');
}

module.exports = {
  TIPOS_NOTIFICACAO_PROBLEMA,
  abrirProblema,
  obterAtivo,
  listarAtivos,
  resolverProblema,
  solicitarCorrecao,
  verificarProblema,
  listarDestinatariosDisponiveis,
  usuarioTemNotificacaoProblema
};
