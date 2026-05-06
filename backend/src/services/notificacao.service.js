const Cliente = require('../models/Cliente');
const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const db = require('../database/connection');

const PERMISSAO_VISUALIZAR = 'notificacoes_visualizar';
const PERMISSAO_RECEBER_TODAS = 'notificacoes_receber_todas';
const TIPO_FIDELIDADE_CLIENTE = 'cliente_fidelidade';
const TIPO_NOTA_RETORNO_PRE = 'nota_retorno_pre';
const TIPO_NOTA_RETORNO_DUE = 'nota_retorno_due';
const TIPOS_PROBLEMA_VENDA = [
  'venda_problema_aberto',
  'venda_problema_resolvido',
  'venda_problema_correcao'
];
const RETORNO_PRE_AVISO_MINUTOS = 15;

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

function parseDataHora(valor) {
  if (!valor) return null;

  const texto = valor instanceof Date
    ? valor.toISOString()
    : String(valor).trim().replace(' ', 'T');
  const data = new Date(texto);

  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarDataHoraBR(valor) {
  const data = parseDataHora(valor);
  if (!data) return '';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
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

async function desativarNotificacoesRetornoNota(notaId, trx = null) {
  const sourceKeys = [
    `${TIPO_NOTA_RETORNO_PRE}:${notaId}`,
    `${TIPO_NOTA_RETORNO_DUE}:${notaId}`
  ];

  const notificacoes = await Notificacao.query(trx)
    .select('id')
    .whereIn('source_key', sourceKeys);

  if (notificacoes.length > 0) {
    await NotificacaoDestinatario.query(trx)
      .whereIn('notificacao_id', notificacoes.map(notificacao => notificacao.id))
      .delete();
  }

  return Notificacao.query(trx)
    .whereIn('source_key', sourceKeys)
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
    titulo: diasRestantes < 0 ? 'Fidelidade de cliente vencida' : 'Fidelidade de cliente perto do fim',
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

async function salvarNotificacaoRetornoNota(nota, etapa, agora) {
  const retorno = parseDataHora(nota.retorno_agendado_para);
  if (!retorno) {
    await desativarNotificacoesRetornoNota(nota.id);
    return null;
  }

  const sourceKey = `${etapa}:${nota.id}`;
  const tituloNota = nota.titulo || 'Sem titulo';
  const destino = nota.entidade_tipo === 'cliente' ? 'clientes' : 'vendas';
  const retornoFormatado = formatarDataHoraBR(nota.retorno_agendado_para);
  const isDue = etapa === TIPO_NOTA_RETORNO_DUE;
  const payload = {
    tipo: etapa,
    titulo: isDue ? 'Retorno de ligacao vencido' : 'Retorno de ligacao em breve',
    mensagem: isDue
      ? `Retorne a ligacao de "${tituloNota}" marcada para ${retornoFormatado}.`
      : `Retorno de "${tituloNota}" marcado para ${retornoFormatado}.`,
    nivel: isDue ? 'danger' : 'warn',
    entidade: destino,
    entidade_id: nota.entidade_id,
    source_key: sourceKey,
    dados: JSON.stringify({
      nota_id: nota.id,
      entidade_tipo: nota.entidade_tipo,
      entidade_id: nota.entidade_id,
      retorno_agendado_para: nota.retorno_agendado_para,
      retorno_etapa: isDue ? 'due' : 'pre',
      titulo_nota: tituloNota
    }),
    ativa: true,
    updated_at: agora
  };

  const existente = await Notificacao.query()
    .where('source_key', sourceKey)
    .first();

  const notificacao = existente
    ? await Notificacao.query().patchAndFetchById(existente.id, payload)
    : await Notificacao.query().insertAndFetch(payload);

  const destinatario = await NotificacaoDestinatario.query()
    .where('notificacao_id', notificacao.id)
    .where('usuario_id', nota.usuario_id)
    .first();

  if (!destinatario) {
    await NotificacaoDestinatario.query().insert({
      notificacao_id: notificacao.id,
      usuario_id: nota.usuario_id
    });
  }

  return notificacao;
}

async function sincronizarRetornosNotas(usuarioId = null) {
  const agora = new Date();
  const limitePreAviso = new Date(agora.getTime() + RETORNO_PRE_AVISO_MINUTOS * 60000);
  const query = db('entidade_notas')
    .whereNotNull('retorno_agendado_para')
    .where('retorno_agendado_para', '<=', limitePreAviso)
    .select('id', 'entidade_tipo', 'entidade_id', 'usuario_id', 'titulo', 'retorno_agendado_para');

  if (usuarioId) {
    query.where('usuario_id', Number(usuarioId));
  }

  const notas = await query;

  for (const nota of notas) {
    const retorno = parseDataHora(nota.retorno_agendado_para);
    if (!retorno) {
      await desativarNotificacoesRetornoNota(nota.id);
      continue;
    }

    if (retorno <= agora) {
      await Notificacao.query()
        .where('source_key', `${TIPO_NOTA_RETORNO_PRE}:${nota.id}`)
        .patch({ ativa: false, updated_at: agora });
      await salvarNotificacaoRetornoNota(nota, TIPO_NOTA_RETORNO_DUE, agora);
    } else {
      await salvarNotificacaoRetornoNota(nota, TIPO_NOTA_RETORNO_PRE, agora);
    }
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
  await sincronizarRetornosNotas(usuarioId);

  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);

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

  if (!podeVerTudo) {
    query.whereIn('n.tipo', TIPOS_PROBLEMA_VENDA);
  }

  if (filtros.nao_lidas) {
    query.whereNull('nd.lida_em');
  }

  const contadorQuery = NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .whereNull('nd.lida_em')
    .count('nd.id as total')
    .first();

  if (!podeVerTudo) {
    contadorQuery.whereIn('n.tipo', TIPOS_PROBLEMA_VENDA);
  }

  const [notificacoes, contador] = await Promise.all([
    query,
    contadorQuery
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

async function listarUrgentes(usuarioId) {
  const notificacoes = await NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .whereIn('n.tipo', TIPOS_PROBLEMA_VENDA)
    .whereNull('nd.popup_visto_em')
    .orderBy('n.updated_at', 'asc')
    .limit(5)
    .select(
      'nd.id as destinatario_id',
      'nd.lida_em',
      'nd.popup_visto_em',
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

  return notificacoes.map(notificacao => ({
    ...notificacao,
    dados: parseDados(notificacao.dados),
    lida: Boolean(notificacao.lida_em)
  }));
}

async function marcarComoLida(notificacaoId, usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const query = NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('n.id', notificacaoId)
    .where('nd.usuario_id', usuarioId)
    .whereNull('nd.lida_em')
    .select('nd.id');

  if (!podeVerTudo) {
    query.whereIn('n.tipo', TIPOS_PROBLEMA_VENDA);
  }

  const destinatario = await query.first();

  if (!destinatario) {
    return false;
  }

  await NotificacaoDestinatario.query()
    .patchAndFetchById(destinatario.id, { lida_em: new Date() });

  return true;
}

async function marcarTodasComoLidas(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const query = NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('nd.usuario_id', usuarioId)
    .where('n.ativa', true)
    .whereNull('nd.lida_em')
    .select('nd.id');

  if (!podeVerTudo) {
    query.whereIn('n.tipo', TIPOS_PROBLEMA_VENDA);
  }

  const destinatarios = await query;

  if (destinatarios.length === 0) {
    return 0;
  }

  return NotificacaoDestinatario.query()
    .whereIn('id', destinatarios.map(item => item.id))
    .patch({ lida_em: new Date() });
}

async function marcarPopupVisto(notificacaoId, usuarioId) {
  const destinatario = await NotificacaoDestinatario.query()
    .alias('nd')
    .join('notificacoes as n', 'nd.notificacao_id', 'n.id')
    .where('n.id', notificacaoId)
    .where('nd.usuario_id', usuarioId)
    .whereIn('n.tipo', TIPOS_PROBLEMA_VENDA)
    .whereNull('nd.popup_visto_em')
    .select('nd.id')
    .first();

  if (!destinatario) {
    return false;
  }

  await NotificacaoDestinatario.query()
    .patchAndFetchById(destinatario.id, { popup_visto_em: new Date() });

  return true;
}

module.exports = {
  PERMISSAO_VISUALIZAR,
  PERMISSAO_RECEBER_TODAS,
  TIPOS_PROBLEMA_VENDA,
  listarNotificacoes,
  listarUrgentes,
  marcarComoLida,
  marcarPopupVisto,
  marcarTodasComoLidas,
  sincronizarFidelidadeCliente,
  sincronizarNotificacoesFidelidade,
  desativarNotificacoesRetornoNota,
  sincronizarRetornosNotas
};
