const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const Venda = require('../models/Venda');
const VendaAprovacaoSolicitacao = require('../models/VendaAprovacaoSolicitacao');
const VendaHistorico = require('../models/VendaHistorico');

const STATUS_PENDENTE = 'pendente';
const STATUS_APROVADA = 'aprovada';
const STATUS_RECUSADA = 'recusada';
const STATUS_OBSOLETA = 'obsoleta';
const MOTIVO_VENDA_COMPARTILHADA = 'venda_compartilhada';
const MOTIVO_CLIENTE_COM_VENDA_EXISTENTE = 'cliente_com_venda_existente';
const TIPO_NOTIFICACAO_APROVACAO = 'venda_aprovacao_pendente';
const PERMISSAO_VISUALIZAR = 'vendas_aprovacoes_visualizar';
const PERMISSAO_DECIDIR = 'vendas_aprovacoes_decidir';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      if (Array.isArray(parsed)) return parsed;
      return Object.entries(parsed).filter(([, permitido]) => permitido === true).map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes).filter(([, permitido]) => permitido === true).map(([chave]) => chave);
}

function usuarioTemPermissao(usuario, permissao) {
  if (!usuario || !usuario.ativo) return false;
  if (usuario.role?.nome === 'admin') return true;

  return [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ].includes(permissao);
}

function formatarDateTimeSQL(data = new Date()) {
  const pad = valor => String(valor).padStart(2, '0');

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

function parseJson(valor, fallback = []) {
  if (!valor) return fallback;
  if (Array.isArray(valor)) return valor;

  if (typeof valor === 'string') {
    try {
      return JSON.parse(valor);
    } catch {
      return fallback;
    }
  }

  return valor;
}

function normalizarMotivos(motivos = []) {
  return Array.from(new Set(motivos)).sort();
}

function motivosIguais(a = [], b = []) {
  return JSON.stringify(normalizarMotivos(a)) === JSON.stringify(normalizarMotivos(b));
}

function nomeVenda(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

function descreverMotivo(motivo) {
  if (motivo === MOTIVO_VENDA_COMPARTILHADA) return 'venda compartilhada';
  if (motivo === MOTIVO_CLIENTE_COM_VENDA_EXISTENTE) return 'cliente com venda existente';
  return motivo;
}

function montarMensagemMotivos(motivos) {
  return normalizarMotivos(motivos).map(descreverMotivo).join(' e ');
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

async function obterVendaComRelacoes(vendaId, trx = null) {
  return Venda.query(trx)
    .findById(vendaId)
    .whereNull('excluido_em')
    .withGraphFetched('[cliente, vendedora, vendedoras, criador]')
    .modifyGraph('vendedora', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .modifyGraph('vendedoras', builder => builder.select('usuarios.id', 'usuarios.nome', 'usuarios.email', 'usuarios.foto_perfil').orderBy('venda_vendedoras.ordem', 'asc'))
    .modifyGraph('criador', builder => builder.select('id', 'nome', 'email', 'foto_perfil'));
}

async function avaliarRequisitosVenda(vendaId, trx = null) {
  const venda = await obterVendaComRelacoes(vendaId, trx);

  if (!venda) {
    return { venda: null, motivos: [] };
  }

  const motivos = [];
  const vendedoras = Array.isArray(venda.vendedoras) && venda.vendedoras.length > 0
    ? venda.vendedoras
    : (venda.vendedora_id ? [{ id: venda.vendedora_id }] : []);

  if (vendedoras.length > 1) {
    motivos.push(MOTIVO_VENDA_COMPARTILHADA);
  }

  if (venda.cliente?.base_anterior_sistema) {
    motivos.push(MOTIVO_CLIENTE_COM_VENDA_EXISTENTE);
  } else if (venda.cliente_id) {
    const vendaExistente = await Venda.query(trx)
      .where('cliente_id', venda.cliente_id)
      .whereNot('id', venda.id)
      .whereNull('excluido_em')
      .first();

    if (vendaExistente) {
      motivos.push(MOTIVO_CLIENTE_COM_VENDA_EXISTENTE);
    }
  }

  return { venda, motivos: normalizarMotivos(motivos) };
}

async function buscarSolicitacaoAtual(vendaId, trx = null) {
  return VendaAprovacaoSolicitacao.query(trx)
    .where('venda_id', vendaId)
    .whereNot('status', STATUS_OBSOLETA)
    .orderBy('id', 'desc')
    .first();
}

async function obsoletarSolicitacoes(vendaId, trx = null) {
  return VendaAprovacaoSolicitacao.query(trx)
    .where('venda_id', vendaId)
    .whereNot('status', STATUS_OBSOLETA)
    .patch({
      status: STATUS_OBSOLETA,
      updated_at: new Date()
    });
}

async function listarAprovadores(trx = null) {
  const usuarios = await Usuario.query(trx)
    .withGraphFetched('role')
    .where('ativo', true)
    .orderBy('nome', 'asc');

  return usuarios.filter(usuario => usuarioTemPermissao(usuario, PERMISSAO_DECIDIR));
}

async function criarOuAtualizarNotificacaoPendente(solicitacao, venda, trx = null) {
  const aprovadores = await listarAprovadores(trx);
  const destinatariosIds = aprovadores.map(usuario => Number(usuario.id));

  if (destinatariosIds.length === 0) {
    return null;
  }

  const motivos = parseJson(solicitacao.motivos, []);
  const sourceKey = `venda_aprovacao:${solicitacao.id}`;
  const payload = {
    tipo: TIPO_NOTIFICACAO_APROVACAO,
    titulo: 'Venda aguardando liberacao ADM',
    mensagem: `${nomeVenda(venda)} precisa de liberacao por ${montarMensagemMotivos(motivos)}.`,
    nivel: 'warn',
    entidade: 'vendas',
    entidade_id: venda.id,
    source_key: sourceKey,
    dados: JSON.stringify({
      venda_id: venda.id,
      solicitacao_id: solicitacao.id,
      venda_nome: nomeVenda(venda),
      motivos
    }),
    ativa: true,
    updated_at: new Date()
  };

  let notificacao = await Notificacao.query(trx).where('source_key', sourceKey).first();

  notificacao = notificacao
    ? await Notificacao.query(trx).patchAndFetchById(notificacao.id, payload)
    : await Notificacao.query(trx).insertAndFetch(payload);

  await NotificacaoDestinatario.query(trx)
    .where('notificacao_id', notificacao.id)
    .whereNotIn('usuario_id', destinatariosIds)
    .delete();

  for (const usuarioId of destinatariosIds) {
    const existente = await NotificacaoDestinatario.query(trx)
      .where('notificacao_id', notificacao.id)
      .where('usuario_id', usuarioId)
      .first();

    if (!existente) {
      await NotificacaoDestinatario.query(trx).insert({
        notificacao_id: notificacao.id,
        usuario_id: usuarioId
      });
    }
  }

  return notificacao;
}

async function desativarNotificacaoSolicitacao(solicitacaoId, trx = null) {
  return Notificacao.query(trx)
    .where('source_key', `venda_aprovacao:${solicitacaoId}`)
    .patch({ ativa: false, updated_at: new Date() });
}

async function validarEnvioPosVenda(vendaId, usuarioId, trx = null) {
  const { venda, motivos } = await avaliarRequisitosVenda(vendaId, trx);

  if (!venda) {
    return { status: 'not_found' };
  }

  const atual = await buscarSolicitacaoAtual(venda.id, trx);
  const motivosAtuais = atual ? parseJson(atual.motivos, []) : [];

  if (motivos.length === 0) {
    if (atual) {
      await obsoletarSolicitacoes(venda.id, trx);
      await desativarNotificacaoSolicitacao(atual.id, trx);
    }

    return { status: 'liberada', venda };
  }

  if (atual && !motivosIguais(motivosAtuais, motivos)) {
    await obsoletarSolicitacoes(venda.id, trx);
    await desativarNotificacaoSolicitacao(atual.id, trx);
    return criarSolicitacaoPendente(venda, motivos, usuarioId, trx);
  }

  if (atual?.status === STATUS_APROVADA) {
    return { status: 'liberada', venda, solicitacao: atual };
  }

  if (atual?.status === STATUS_RECUSADA) {
    await obsoletarSolicitacoes(venda.id, trx);
    await desativarNotificacaoSolicitacao(atual.id, trx);
    return criarSolicitacaoPendente(venda, motivos, usuarioId, trx);
  }

  if (atual?.status === STATUS_PENDENTE) {
    await criarOuAtualizarNotificacaoPendente(atual, venda, trx);
    return {
      status: 'pendente',
      venda,
      solicitacao: atual,
      message: 'Solicitacao ja esta aguardando aprovacao do ADM.'
    };
  }

  return criarSolicitacaoPendente(venda, motivos, usuarioId, trx);
}

async function criarSolicitacaoPendente(venda, motivos, usuarioId, trx = null) {
  const agora = formatarDateTimeSQL();
  const solicitacao = await VendaAprovacaoSolicitacao.query(trx).insertAndFetch({
    venda_id: venda.id,
    status: STATUS_PENDENTE,
    motivos: JSON.stringify(normalizarMotivos(motivos)),
    solicitado_por_id: usuarioId,
    solicitado_em: agora
  });

  await criarOuAtualizarNotificacaoPendente(solicitacao, venda, trx);

  await registrarHistoricoVenda({
    vendaId: venda.id,
    usuarioId,
    acao: 'venda.aprovacao_solicitada',
    observacao: `Solicitacao de liberacao ADM criada: ${montarMensagemMotivos(motivos)}.`,
    dados: {
      solicitacao_id: solicitacao.id,
      motivos
    },
    trx
  });

  return {
    status: 'pendente',
    venda,
    solicitacao,
    message: 'Solicitacao enviada para aprovacao do ADM.'
  };
}

async function sincronizarAprovacaoAposAlteracao(vendaId, trx = null) {
  const atual = await buscarSolicitacaoAtual(vendaId, trx);
  if (!atual) return null;

  const { motivos } = await avaliarRequisitosVenda(vendaId, trx);
  const motivosAtuais = parseJson(atual.motivos, []);

  if (motivos.length === 0 || !motivosIguais(motivosAtuais, motivos)) {
    await obsoletarSolicitacoes(vendaId, trx);
    await desativarNotificacaoSolicitacao(atual.id, trx);
    return STATUS_OBSOLETA;
  }

  return atual.status;
}

async function listarSolicitacoes(filtros = {}) {
  const statusPermitidos = [STATUS_PENDENTE, STATUS_APROVADA, STATUS_RECUSADA, STATUS_OBSOLETA];
  const query = VendaAprovacaoSolicitacao.query()
    .withGraphFetched('[venda.[cliente, vendedora, vendedoras], solicitante, decisor]')
    .modifyGraph('venda.vendedora', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .modifyGraph('venda.vendedoras', builder => builder.select('usuarios.id', 'usuarios.nome', 'usuarios.email', 'usuarios.foto_perfil').orderBy('venda_vendedoras.ordem', 'asc'))
    .modifyGraph('solicitante', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .modifyGraph('decisor', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .orderBy('solicitado_em', 'desc')
    .orderBy('id', 'desc');

  if (filtros.status && statusPermitidos.includes(filtros.status)) {
    query.where('status', filtros.status);
  }

  const solicitacoes = await query;

  return solicitacoes.map(solicitacao => ({
    ...solicitacao,
    motivos: parseJson(solicitacao.motivos, [])
  }));
}

async function decidirSolicitacao(id, dados, usuarioId, decisao) {
  const status = decisao === 'aprovar' ? STATUS_APROVADA : STATUS_RECUSADA;
  const acao = decisao === 'aprovar' ? 'venda.aprovacao_aprovada' : 'venda.aprovacao_recusada';
  const observacaoDecisao = String(dados?.observacao || '').trim() || null;

  const resultado = await VendaAprovacaoSolicitacao.transaction(async trx => {
    const solicitacao = await VendaAprovacaoSolicitacao.query(trx).findById(id);

    if (!solicitacao || solicitacao.status !== STATUS_PENDENTE) {
      const error = new Error('Solicitacao pendente nao encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const { motivos } = await avaliarRequisitosVenda(solicitacao.venda_id, trx);
    const motivosSolicitacao = parseJson(solicitacao.motivos, []);

    if (motivos.length === 0 || !motivosIguais(motivosSolicitacao, motivos)) {
      await obsoletarSolicitacoes(solicitacao.venda_id, trx);
      await desativarNotificacaoSolicitacao(solicitacao.id, trx);
      return { desatualizada: true };
    }

    const agora = formatarDateTimeSQL();
    const atualizada = await VendaAprovacaoSolicitacao.query(trx).patchAndFetchById(solicitacao.id, {
      status,
      decidido_por_id: usuarioId,
      decidido_em: agora,
      observacao_decisao: observacaoDecisao,
      updated_at: agora
    });

    await desativarNotificacaoSolicitacao(solicitacao.id, trx);

    await registrarHistoricoVenda({
      vendaId: solicitacao.venda_id,
      usuarioId,
      acao,
      observacao: observacaoDecisao || (status === STATUS_APROVADA ? 'Venda liberada pelo ADM.' : 'Venda recusada pelo ADM.'),
      dados: {
        solicitacao_id: solicitacao.id,
        motivos: motivosSolicitacao,
        status
      },
      trx
    });

    return VendaAprovacaoSolicitacao.query(trx)
      .findById(atualizada.id)
      .withGraphFetched('[venda.[cliente, vendedora, vendedoras], solicitante, decisor]');
  });

  if (resultado?.desatualizada) {
    const error = new Error('A solicitacao ficou desatualizada apos alteracoes na venda.');
    error.statusCode = 409;
    throw error;
  }

  return resultado;
}

module.exports = {
  STATUS_PENDENTE,
  STATUS_APROVADA,
  STATUS_RECUSADA,
  STATUS_OBSOLETA,
  TIPO_NOTIFICACAO_APROVACAO,
  PERMISSAO_VISUALIZAR,
  PERMISSAO_DECIDIR,
  avaliarRequisitosVenda,
  validarEnvioPosVenda,
  sincronizarAprovacaoAposAlteracao,
  listarSolicitacoes,
  aprovarSolicitacao: (id, dados, usuarioId) => decidirSolicitacao(id, dados, usuarioId, 'aprovar'),
  recusarSolicitacao: (id, dados, usuarioId) => decidirSolicitacao(id, dados, usuarioId, 'recusar')
};
