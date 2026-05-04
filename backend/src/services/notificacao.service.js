const Cliente = require('../models/Cliente');
const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');

const PERMISSAO_VISUALIZAR = 'notificacoes_visualizar';
const PERMISSAO_RECEBER_TODAS = 'notificacoes_receber_todas';
const TIPO_FIDELIDADE_CLIENTE = 'cliente_fidelidade';

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

function usuarioTemPermissaoLocal(usuario, permissao) {
  if (!usuario || !usuario.ativo) return false;
  if (usuario.role?.nome === 'admin') return true;

  return [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ].includes(permissao);
}

function formatarDataISO(data = new Date()) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0')
  ].join('-');
}

function parseDataDia(valor) {
  if (!valor || valor === '1899-11-30') return null;

  const texto = valor instanceof Date ? formatarDataISO(valor) : String(valor).slice(0, 10);
  const data = new Date(`${texto}T00:00:00`);

  return Number.isNaN(data.getTime()) ? null : data;
}

function calcularDiasRestantes(fidelidadeFim) {
  const fim = parseDataDia(fidelidadeFim);

  if (!fim) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
}

function montarTextoDias(diasRestantes) {
  if (diasRestantes < 0) {
    const diasVencida = Math.abs(diasRestantes);
    return diasVencida === 1 ? 'venceu ha 1 dia' : `venceu ha ${diasVencida} dias`;
  }

  if (diasRestantes === 0) return 'termina hoje';
  if (diasRestantes === 1) return 'termina em 1 dia';
  return `termina em ${diasRestantes} dias`;
}

function montarNivel(diasRestantes) {
  if (diasRestantes < 0) return 'danger';
  if (diasRestantes <= 3) return 'danger';
  if (diasRestantes <= 10) return 'warn';
  return 'info';
}

async function listarUsuariosDestinatarios(cliente) {
  const usuarios = await Usuario.query()
    .withGraphFetched('role')
    .where('ativo', true);
  const ids = new Set();

  usuarios.forEach(usuario => {
    if (usuario.role?.nome === 'admin' || usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS)) {
      ids.add(Number(usuario.id));
    }
  });

  if (cliente.criado_por_id) {
    const criador = usuarios.find(usuario => Number(usuario.id) === Number(cliente.criado_por_id));

    if (criador?.ativo) {
      ids.add(Number(cliente.criado_por_id));
    }
  }

  return Array.from(ids);
}

async function desativarNotificacaoFidelidadeCliente(clienteId, trx = null) {
  return Notificacao.query(trx)
    .where('source_key', `${TIPO_FIDELIDADE_CLIENTE}:${clienteId}`)
    .patch({ ativa: false, updated_at: new Date() });
}

async function sincronizarFidelidadeCliente(clienteId, trx = null) {
  const cliente = await Cliente.query(trx)
    .findById(clienteId)
    .whereNull('excluido_em');

  if (!cliente) {
    await desativarNotificacaoFidelidadeCliente(clienteId, trx);
    return null;
  }

  const diasRestantes = calcularDiasRestantes(cliente.fidelidade_fim);

  if (diasRestantes === null || diasRestantes > 30) {
    await desativarNotificacaoFidelidadeCliente(cliente.id, trx);
    return null;
  }

  const nomeCliente = cliente.nome || cliente.razao_social || `Cliente #${cliente.id}`;
  const sourceKey = `${TIPO_FIDELIDADE_CLIENTE}:${cliente.id}`;
  const dados = {
    cliente_id: cliente.id,
    cliente_nome: nomeCliente,
    fidelidade_fim: cliente.fidelidade_fim,
    dias_restantes: diasRestantes
  };

  let notificacao = await Notificacao.query(trx)
    .where('source_key', sourceKey)
    .first();

  const payload = {
    tipo: TIPO_FIDELIDADE_CLIENTE,
    titulo: 'Fidelidade de cliente perto do fim',
    mensagem: `A fidelidade de ${nomeCliente} ${montarTextoDias(diasRestantes)}.`,
    nivel: montarNivel(diasRestantes),
    entidade: 'clientes',
    entidade_id: cliente.id,
    source_key: sourceKey,
    dados: JSON.stringify(dados),
    ativa: true,
    updated_at: new Date()
  };

  if (notificacao) {
    notificacao = await Notificacao.query(trx)
      .patchAndFetchById(notificacao.id, payload);
  } else {
    notificacao = await Notificacao.query(trx)
      .insertAndFetch(payload);
  }

  const destinatarios = await listarUsuariosDestinatarios(cliente);

  const destinatariosQuery = NotificacaoDestinatario.query(trx)
    .where('notificacao_id', notificacao.id);

  if (destinatarios.length > 0) {
    destinatariosQuery.whereNotIn('usuario_id', destinatarios);
  }

  await destinatariosQuery.delete();

  for (const usuarioId of destinatarios) {
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

async function sincronizarNotificacoesFidelidade() {
  const clientes = await Cliente.query()
    .select('id')
    .whereNull('excluido_em')
    .whereNotNull('fidelidade_fim');

  for (const cliente of clientes) {
    await sincronizarFidelidadeCliente(cliente.id);
  }
}

function parseDados(dados) {
  if (!dados) return {};

  if (typeof dados === 'string') {
    try {
      return JSON.parse(dados);
    } catch {
      return {};
    }
  }

  return dados;
}

async function listarNotificacoes(usuarioId, filtros = {}) {
  await sincronizarNotificacoesFidelidade();

  const limit = Math.min(Number(filtros.limit || 20), 50);
  const query = NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .orderByRaw('nd.lida_em IS NULL DESC')
    .orderBy('n.updated_at', 'desc')
    .limit(limit)
    .select(
      'nd.id as destinatario_id',
      'nd.lida_em',
      'n.id',
      'n.tipo',
      'n.titulo',
      'n.mensagem',
      'n.nivel',
      'n.entidade',
      'n.entidade_id',
      'n.dados',
      'n.created_at',
      'n.updated_at'
    );

  if (filtros.nao_lidas) {
    query.whereNull('nd.lida_em');
  }

  const [notificacoes, contador] = await Promise.all([
    query,
    NotificacaoDestinatario.query()
      .alias('nd')
      .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
      .where('nd.usuario_id', usuarioId)
      .where('n.ativa', true)
      .whereNull('nd.lida_em')
      .count('nd.id as total')
      .first()
  ]);

  return {
    unread_count: Number(contador?.total || 0),
    notificacoes: notificacoes.map(notificacao => ({
      ...notificacao,
      dados: parseDados(notificacao.dados),
      lida: Boolean(notificacao.lida_em)
    }))
  };
}

async function marcarComoLida(notificacaoId, usuarioId) {
  const destinatario = await NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('n.id', notificacaoId)
    .where('nd.usuario_id', usuarioId)
    .whereNull('nd.lida_em')
    .select('nd.id')
    .first();

  if (!destinatario) {
    return false;
  }

  await NotificacaoDestinatario.query()
    .patchAndFetchById(destinatario.id, { lida_em: new Date() });

  return true;
}

async function marcarTodasComoLidas(usuarioId) {
  const destinatarios = await NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .whereNull('nd.lida_em')
    .select('nd.id');

  if (destinatarios.length === 0) {
    return 0;
  }

  return NotificacaoDestinatario.query()
    .whereIn('id', destinatarios.map(item => item.id))
    .patch({ lida_em: new Date() });
}

module.exports = {
  PERMISSAO_VISUALIZAR,
  PERMISSAO_RECEBER_TODAS,
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  sincronizarFidelidadeCliente,
  sincronizarNotificacoesFidelidade
};
