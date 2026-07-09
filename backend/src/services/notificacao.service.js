/**
 * Servico de notificacoes, destinatarios, leitura e exibicao de popups.
 */
const Cliente = require('../models/Cliente');
const ClienteOperadora = require('../models/ClienteOperadora');
const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const db = require('../database/connection');
const vendaNotificacaoParadaService = require('./venda-notificacao-parada.service');
const notificacaoEmailService = require('./notificacao-email.service');
const { parseUtcDateTime } = require('../utils/datetime');
const {
  parsePermissoes,
  usuarioTemPermissaoLocal: usuarioTemPermissaoLocalImportado
} = require('../utils/permissoes');

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
const TIPOS_APROVACAO_VENDA = ['venda_aprovacao_pendente'];
const TIPOS_RETORNO_VENDA = ['venda_retorno_registrado'];
const TIPOS_CANCELAMENTO_VENDA = ['venda_cancelada'];
const TIPOS_BASE_VENDA = [
  ...TIPOS_PROBLEMA_VENDA,
  ...TIPOS_RETORNO_VENDA,
  ...TIPOS_CANCELAMENTO_VENDA
];
const TIPOS_OPERACIONAIS_VENDA = [
  ...TIPOS_BASE_VENDA,
  ...TIPOS_APROVACAO_VENDA
];
const TIPO_VENDA_PARADA = vendaNotificacaoParadaService.TIPO_NOTIFICACAO;
const PERMISSAO_VENDAS_PARADAS = vendaNotificacaoParadaService.PERMISSAO_VENDAS_PARADAS;

/**
 * Verifica se usuario tem permissao local atende a condicao esperada.
 */
function usuarioTemPermissaoLocal(usuario, permissao) {
  return usuarioTemPermissaoLocalImportado(usuario, permissao);
}

/**
 * Lista admins ativos conforme os filtros e parametros informados.
 */
async function listarAdminsAtivos(trx = null) {
  const usuarios = await Usuario.query(trx)
    .withGraphFetched('role')
    .where('ativo', true);

  return usuarios
    .filter(usuario => usuario.role?.nome === 'admin')
    .map(usuario => Number(usuario.id));
}

/**
 * Formata data iso para exibicao ou envio.
 */
function formatarDataISO(data = new Date()) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0')
  ].join('-');
}

/**
 * Converte data dia para o formato interno esperado.
 */
function parseDataDia(valor) {
  if (!valor || valor === '1899-11-30') return null;

  const texto = valor instanceof Date ? formatarDataISO(valor) : String(valor).slice(0, 10);
  const data = new Date(`${texto}T00:00:00`);

  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Calcula dias restantes com base nos valores informados.
 */
function calcularDiasRestantes(fidelidadeFim) {
  const fim = parseDataDia(fidelidadeFim);

  if (!fim) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
}

/**
 * Monta texto dias a partir dos dados informados.
 */
function montarTextoDias(diasRestantes) {
  if (diasRestantes < 0) {
    const diasVencida = Math.abs(diasRestantes);
    return diasVencida === 1 ? 'venceu há 1 dia' : `venceu há ${diasVencida} dias`;
  }

  if (diasRestantes === 0) return 'termina hoje';
  if (diasRestantes === 1) return 'termina em 1 dia';
  return `termina em ${diasRestantes} dias`;
}

/**
 * Monta nivel a partir dos dados informados.
 */
function montarNivel(diasRestantes) {
  if (diasRestantes < 0) return 'danger';
  if (diasRestantes <= 3) return 'danger';
  if (diasRestantes <= 10) return 'warn';
  return 'info';
}

/**
 * Converte data hora para o formato interno esperado.
 */
function parseDataHora(valor) {
  return parseUtcDateTime(valor);
}

/**
 * Formata data hora br para exibicao ou envio.
 */
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

/**
 * Lista usuarios destinatarios conforme os filtros e parametros informados.
 */
async function listarUsuariosDestinatarios(cliente) {
  const usuarios = await Usuario.query()
    .withGraphFetched('role')
    .where('ativo', true);
  const ids = new Set();

  usuarios.forEach(usuario => {
    if (usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS)) {
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

/**
 * Desativa notificacao fidelidade cliente quando nao e mais necessaria.
 */
async function desativarNotificacaoFidelidadeCliente(clienteId, trx = null) {
  return Notificacao.query(trx)
    .where(function () {
      this.where('source_key', `${TIPO_FIDELIDADE_CLIENTE}:${clienteId}`)
        .orWhere('source_key', 'like', `${TIPO_FIDELIDADE_CLIENTE}:${clienteId}:%`);
    })
    .patch({ ativa: false, updated_at: new Date() });
}

/**
 * Desativa notificacoes retorno nota quando nao e mais necessaria.
 */
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

/**
 * Sincroniza fidelidade cliente com os dados atuais.
 */
async function sincronizarFidelidadeCliente(clienteId, trx = null) {
  const cliente = await Cliente.query(trx)
    .findById(clienteId)
    .whereNull('excluido_em')
    .withGraphFetched('operadorasAtuais.operadora');

  if (!cliente) {
    await desativarNotificacaoFidelidadeCliente(clienteId, trx);
    return null;
  }

  await Notificacao.query(trx)
    .where('source_key', `${TIPO_FIDELIDADE_CLIENTE}:${cliente.id}`)
    .patch({ ativa: false, updated_at: new Date() });

  const operadoras = cliente.operadorasAtuais?.length > 0
    ? cliente.operadorasAtuais
    : [];
  const sourceKeysAtivas = [];
  let ultimaNotificacao = null;

  for (const clienteOperadora of operadoras) {
    const diasRestantes = calcularDiasRestantes(clienteOperadora.fidelidade_fim);
    const sourceKey = `${TIPO_FIDELIDADE_CLIENTE}:${cliente.id}:${clienteOperadora.id}`;
    sourceKeysAtivas.push(sourceKey);

    if (diasRestantes === null || diasRestantes > 30) {
      await Notificacao.query(trx)
        .where('source_key', sourceKey)
        .patch({ ativa: false, updated_at: new Date() });
      continue;
    }

    const nomeCliente = cliente.nome || cliente.razao_social || `Cliente #${cliente.id}`;
    const nomeOperadora = clienteOperadora.operadora?.nome || 'Operadora';
    const dados = {
      cliente_id: cliente.id,
      cliente_operadora_id: clienteOperadora.id,
      operadora_id: clienteOperadora.operadora_id,
      operadora_nome: nomeOperadora,
      cliente_nome: nomeCliente,
      fidelidade_fim: clienteOperadora.fidelidade_fim,
      dias_restantes: diasRestantes
    };

    let notificacao = await Notificacao.query(trx)
      .where('source_key', sourceKey)
      .first();

    const payload = {
      tipo: TIPO_FIDELIDADE_CLIENTE,
      titulo: diasRestantes < 0 ? 'Fidelidade de cliente vencida' : 'Fidelidade de cliente perto do fim',
      mensagem: `A fidelidade de ${nomeCliente} na ${nomeOperadora} ${montarTextoDias(diasRestantes)}.`,
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

    const knex = trx || db;
    for (const usuarioId of destinatarios) {
      await knex('notificacao_destinatarios')
        .insert({
          notificacao_id: notificacao.id,
          usuario_id: usuarioId
        })
        .onConflict(['notificacao_id', 'usuario_id'])
        .ignore();
    }

    notificacaoEmailService.enviarEmailsPendentesAsync(notificacao.id);
    ultimaNotificacao = notificacao;
  }

  const queryInativas = Notificacao.query(trx)
    .where('source_key', 'like', `${TIPO_FIDELIDADE_CLIENTE}:${cliente.id}:%`);

  if (sourceKeysAtivas.length > 0) {
    queryInativas.whereNotIn('source_key', sourceKeysAtivas);
  }

  await queryInativas.patch({ ativa: false, updated_at: new Date() });

  return ultimaNotificacao;
}

/**
 * Sincroniza notificacoes fidelidade com os dados atuais.
 */
async function sincronizarNotificacoesFidelidade() {
  const clientes = await Cliente.query()
    .select('id')
    .whereNull('excluido_em')
    .whereExists(
      ClienteOperadora.query()
        .select(db.raw('1'))
        .whereRaw('cliente_operadoras.cliente_id = clientes.id')
        .whereNotNull('fidelidade_fim')
    );

  for (const cliente of clientes) {
    await sincronizarFidelidadeCliente(cliente.id);
  }
}

/**
 * Salva notificacao retorno nota com os dados informados.
 */
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

  // Upsert pelo unique de source_key: duas requisicoes concorrentes de
  // GET /notificacoes sincronizam a mesma nota ao mesmo tempo.
  await db('notificacoes')
    .insert(payload)
    .onConflict('source_key')
    .merge({
      tipo: payload.tipo,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      nivel: payload.nivel,
      entidade: payload.entidade,
      entidade_id: payload.entidade_id,
      dados: payload.dados,
      ativa: payload.ativa,
      updated_at: payload.updated_at
    });

  const notificacao = await Notificacao.query()
    .where('source_key', sourceKey)
    .first();

  const adminsIds = await listarAdminsAtivos();
  const destinatariosIds = Array.from(new Set([Number(nota.usuario_id), ...adminsIds].filter(Boolean)));

  for (const usuarioId of destinatariosIds) {
    await db('notificacao_destinatarios')
      .insert({
        notificacao_id: notificacao.id,
        usuario_id: usuarioId
      })
      .onConflict(['notificacao_id', 'usuario_id'])
      .ignore();
  }

  notificacaoEmailService.enviarEmailsPendentesAsync(notificacao.id);

  return notificacao;
}

/**
 * Sincroniza retornos notas com os dados atuais.
 */
async function sincronizarRetornosNotas(usuarioId = null) {
  const agora = new Date();
  // Gera a notificacao assim que a nota tem data de retorno marcada (qualquer data),
  // independente da janela de pre-aviso e do status de pos-venda da venda.
  const query = db('entidade_notas')
    .whereNotNull('retorno_agendado_para')
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

/**
 * Converte dados para o formato interno esperado.
 */
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

/**
 * Aplica join destinatario usuario sobre a consulta ou conjunto informado.
 */
function aplicarJoinDestinatarioUsuario(query, usuarioId) {
  return query.leftJoin('notificacao_destinatarios as nd', function () {
    this.on('nd.notificacao_id', '=', 'n.id')
      .andOn('nd.usuario_id', '=', db.raw('?', [Number(usuarioId)]));
  });
}

/**
 * Aplica filtro tipos visiveis sobre a consulta ou conjunto informado.
 */
function aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas }) {
  if (!podeReceberTodas) {
    query.whereNotNull('nd.id');
  }

  if (!podeVerTudo) {
    query.whereIn('n.tipo', [
      ...(podeVerAprovacoes ? TIPOS_OPERACIONAIS_VENDA : TIPOS_BASE_VENDA),
      ...(podeVerVendasParadas ? [TIPO_VENDA_PARADA] : [])
    ]);
  } else if (!podeVerVendasParadas) {
    query.whereNot('n.tipo', TIPO_VENDA_PARADA);
  }

  return query;
}

/**
 * Mapeia notificacao para o formato usado pela aplicacao.
 */
function mapearNotificacao(notificacao) {
  return {
    ...notificacao,
    dados: parseDados(notificacao.dados),
    lida: Boolean(notificacao.lida_em)
  };
}

/**
 * Exclui notificacoes por ids conforme a regra de negocio.
 */
async function excluirNotificacoesPorIds(notificacaoIds, trx) {
  const ids = [...new Set(notificacaoIds.map(id => Number(id)).filter(Boolean))];
  if (ids.length === 0) return 0;

  await trx('notificacao_destinatarios')
    .whereIn('notificacao_id', ids)
    .delete();

  await trx('notificacoes')
    .whereIn('id', ids)
    .delete();

  return ids.length;
}

/**
 * Busca notificacoes sem entidade conforme os parametros informados.
 */
async function buscarNotificacoesSemEntidade(tabela, trx) {
  const alias = tabela === 'clientes' ? 'c' : 'v';

  return trx('notificacoes as n')
    .leftJoin(`${tabela} as ${alias}`, 'n.entidade_id', `${alias}.id`)
    .where('n.entidade', tabela)
    .whereNotNull('n.entidade_id')
    .where(builder => {
      builder
        .whereNull(`${alias}.id`)
        .orWhereNotNull(`${alias}.excluido_em`);
    })
    .select('n.id');
}

/**
 * Limpa notificacoes sem objeto referente e restaura o estado inicial.
 */
async function limparNotificacoesSemObjetoReferente() {
  return db.transaction(async trx => {
    const [notificacoesClientes, notificacoesVendas] = await Promise.all([
      buscarNotificacoesSemEntidade('clientes', trx),
      buscarNotificacoesSemEntidade('vendas', trx)
    ]);

    return excluirNotificacoesPorIds([
      ...notificacoesClientes.map(notificacao => notificacao.id),
      ...notificacoesVendas.map(notificacao => notificacao.id)
    ], trx);
  });
}

/**
 * Lista notificacoes conforme os filtros e parametros informados.
 */
async function listarNotificacoes(usuarioId, filtros = {}) {
  await sincronizarNotificacoesFidelidade();
  await sincronizarRetornosNotas(usuarioId);
  await vendaNotificacaoParadaService.sincronizarVendasParadas();
  await limparNotificacoesSemObjetoReferente();

  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeReceberTodas = usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS);
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const podeVerAprovacoes = usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_visualizar')
    || usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_decidir');
  const podeVerVendasParadas = usuarioTemPermissaoLocal(usuario, PERMISSAO_VENDAS_PARADAS);

  const limit = Math.min(Number(filtros.limit || 20), 50);
  const query = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
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

  aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  if (filtros.nao_lidas) {
    query.whereNull('nd.lida_em');
  }

  const contadorQuery = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
    .where('n.ativa', true)
    .whereNull('nd.lida_em')
    .count('n.id as total')
    .first();

  aplicarFiltroTiposVisiveis(contadorQuery, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  const [notificacoes, contador] = await Promise.all([
    query,
    contadorQuery
  ]);

  return {
    unread_count: Number(contador?.total || 0),
    notificacoes: notificacoes.map(mapearNotificacao)
  };
}

/**
 * Lista urgentes conforme os filtros e parametros informados.
 */
async function listarUrgentes(usuarioId) {
  await sincronizarNotificacoesFidelidade();
  await sincronizarRetornosNotas(usuarioId);
  await vendaNotificacaoParadaService.sincronizarVendasParadas();
  await limparNotificacoesSemObjetoReferente();

  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeReceberTodas = usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS);
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const podeVerAprovacoes = usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_visualizar')
    || usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_decidir');
  const podeVerVendasParadas = usuarioTemPermissaoLocal(usuario, PERMISSAO_VENDAS_PARADAS);

  const query = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
    .where('n.ativa', true)
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

  aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  const notificacoes = await query;

  return notificacoes.map(mapearNotificacao);
}

/**
 * Marca como lida conforme a acao solicitada.
 */
async function marcarComoLida(notificacaoId, usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeReceberTodas = usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS);
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const podeVerAprovacoes = usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_visualizar')
    || usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_decidir');
  const podeVerVendasParadas = usuarioTemPermissaoLocal(usuario, PERMISSAO_VENDAS_PARADAS);

  const query = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
    .where('n.id', notificacaoId)
    .where('n.ativa', true)
    .select('n.id', 'nd.id as destinatario_id', 'nd.lida_em');

  aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  const notificacao = await query.first();

  if (!notificacao) {
    return false;
  }

  if (notificacao.destinatario_id) {
    if (!notificacao.lida_em) {
      await NotificacaoDestinatario.query()
        .patchAndFetchById(notificacao.destinatario_id, { lida_em: new Date() });
    }
  } else {
    await NotificacaoDestinatario.query().insert({
      notificacao_id: notificacao.id,
      usuario_id: usuarioId,
      lida_em: new Date()
    });
  }

  return true;
}

/**
 * Marca todas como lidas conforme a acao solicitada.
 */
async function marcarTodasComoLidas(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeReceberTodas = usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS);
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const podeVerAprovacoes = usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_visualizar')
    || usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_decidir');
  const podeVerVendasParadas = usuarioTemPermissaoLocal(usuario, PERMISSAO_VENDAS_PARADAS);

  const query = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
    .where('n.ativa', true)
    .whereNull('nd.lida_em')
    .select('n.id', 'nd.id as destinatario_id');

  aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  const notificacoes = await query;

  if (notificacoes.length === 0) {
    return 0;
  }

  const agora = new Date();
  const destinatariosExistentes = notificacoes
    .map(item => item.destinatario_id)
    .filter(Boolean);
  const notificacoesSemDestinatario = notificacoes
    .filter(item => !item.destinatario_id)
    .map(item => item.id);

  if (destinatariosExistentes.length > 0) {
    await NotificacaoDestinatario.query()
      .whereIn('id', destinatariosExistentes)
      .patch({ lida_em: agora });
  }

  for (const notificacaoId of notificacoesSemDestinatario) {
    await NotificacaoDestinatario.query().insert({
      notificacao_id: notificacaoId,
      usuario_id: usuarioId,
      lida_em: agora
    });
  }

  return notificacoes.length;
}

/**
 * Marca popup visto conforme a acao solicitada.
 */
async function marcarPopupVisto(notificacaoId, usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');
  const podeReceberTodas = usuarioTemPermissaoLocal(usuario, PERMISSAO_RECEBER_TODAS);
  const podeVerTudo = usuarioTemPermissaoLocal(usuario, PERMISSAO_VISUALIZAR);
  const podeVerAprovacoes = usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_visualizar')
    || usuarioTemPermissaoLocal(usuario, 'vendas_aprovacoes_decidir');
  const podeVerVendasParadas = usuarioTemPermissaoLocal(usuario, PERMISSAO_VENDAS_PARADAS);

  const query = aplicarJoinDestinatarioUsuario(Notificacao.query().alias('n'), usuarioId)
    .where('n.id', notificacaoId)
    .where('n.ativa', true)
    .select('n.id', 'nd.id as destinatario_id', 'nd.popup_visto_em');

  aplicarFiltroTiposVisiveis(query, { podeReceberTodas, podeVerTudo, podeVerAprovacoes, podeVerVendasParadas });

  const notificacao = await query.first();

  if (!notificacao) {
    return false;
  }

  if (notificacao.destinatario_id) {
    if (!notificacao.popup_visto_em) {
      await NotificacaoDestinatario.query()
        .patchAndFetchById(notificacao.destinatario_id, { popup_visto_em: new Date() });
    }
  } else {
    await NotificacaoDestinatario.query().insert({
      notificacao_id: notificacao.id,
      usuario_id: usuarioId,
      popup_visto_em: new Date()
    });
  }

  return true;
}

module.exports = {
  PERMISSAO_VISUALIZAR,
  PERMISSAO_RECEBER_TODAS,
  TIPOS_PROBLEMA_VENDA,
  TIPOS_APROVACAO_VENDA,
  TIPOS_RETORNO_VENDA,
  listarAdminsAtivos,
  listarNotificacoes,
  listarUrgentes,
  marcarComoLida,
  marcarPopupVisto,
  marcarTodasComoLidas,
  sincronizarFidelidadeCliente,
  sincronizarNotificacoesFidelidade,
  desativarNotificacoesRetornoNota,
  sincronizarRetornosNotas,
  limparNotificacoesSemObjetoReferente
};
