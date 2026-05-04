const Venda = require('../models/Venda');
const VendaHistorico = require('../models/VendaHistorico');
const Usuario = require('../models/Usuario');
const FunilEtapa = require('../models/FunilEtapa');
const clienteService = require('./cliente.service');

const CAMPOS = [
  'nome',
  'telefone',
  'email',
  'email_2',
  'nome_representante_legal',
  'fixo_ddd',
  'nome_fechou_venda',
  'cpf_representante_legal',
  'setor_funcao',
  'produto_fechado',
  'tipo_venda_id',
  'servico_id',
  'quantidade_linhas',
  'ddd',
  'numeros_portados',
  'gb',
  'valores_unitarios_chips',
  'ponto_referencia',
  'tipo_local_cpf',
  'razao_social',
  'cnpj',
  'data_venda',
  'qc_feito_por',
  'observacoes',
  'cliente_id',
  'dia_vencimento',
  'endereco',
  'numero_endereco',
  'complemento',
  'bairro',
  'municipio',
  'uf',
  'cep',
  'horario_aceite_voz',
  'responsavel_recebimento',
  'rg_responsavel_recebimento',
  'nome_administrador',
  'cpf_administrador',
  'operadora_id',
  'plano_id',
  'vendedora_id',
  'status_funil',
  'prioridade_funil',
  'status_anterior_retorno',
  'motivo_retorno',
  'nota_correcao_retorno',
  'retornou_em',
  'corrigido_em'
];

const FUNIL_STATUS = ['aprovacao', 'ativacao', 'envio', 'entrega', 'confirmacao', 'concluido', 'retorno'];

const FUNIL_STATUS_LABELS = {
  aprovacao: 'Aprovacao',
  ativacao: 'Ativacao',
  envio: 'Envio / Logistica',
  entrega: 'Entrega',
  confirmacao: 'Confirmacao do cliente',
  concluido: 'Concluido',
  retorno: 'Retorno recebido'
};

const FUNIL_PRIORIDADES = ['alta', 'media', 'baixa'];

function limparValor(valor) {
  if (valor === undefined) return undefined;
  if (valor === '') return null;
  return valor;
}

function normalizarData(valor) {
  if (!valor) return null;

  const texto = valor instanceof Date
    ? [
        valor.getFullYear(),
        String(valor.getMonth() + 1).padStart(2, '0'),
        String(valor.getDate()).padStart(2, '0')
      ].join('-')
    : String(valor).trim();
  const textoISO = texto.slice(0, 10);
  const dataISO = textoISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (dataISO) {
    const [, ano, mes, dia] = dataISO;
    const data = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    const dataValida = data.getFullYear() === Number(ano)
      && data.getMonth() + 1 === Number(mes)
      && data.getDate() === Number(dia);

    return dataValida && Number(ano) >= 1900 ? textoISO : null;
  }

  if (!match) return null;

  const [, dia, mes, ano] = match;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  const data = new Date(`${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T00:00:00`);
  const dataValida = data.getFullYear() === Number(anoCompleto)
    && data.getMonth() + 1 === Number(mes)
    && data.getDate() === Number(dia);

  if (!dataValida || Number(anoCompleto) < 1900) {
    return null;
  }

  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
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

function montarDadosHistorico(dados = {}) {
  return JSON.stringify(dados);
}

async function registrarHistoricoVenda({
  vendaId,
  usuarioId,
  acao,
  statusAnterior = null,
  statusNovo = null,
  observacao = null,
  dados = {},
  createdAt = formatarDateTimeSQL(),
  trx
}) {
  return VendaHistorico.query(trx).insert({
    venda_id: Number(vendaId),
    usuario_id: usuarioId ? Number(usuarioId) : null,
    acao,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    observacao,
    dados: montarDadosHistorico(dados),
    created_at: createdAt
  });
}

async function copiarNotasClienteParaVenda({ clienteId, vendaId, createdAt, trx }) {
  if (!clienteId || !vendaId) return 0;

  const notasCliente = await trx('entidade_notas')
    .where({
      entidade_tipo: 'cliente',
      entidade_id: Number(clienteId)
    })
    .select('usuario_id', 'titulo', 'conteudo');

  if (notasCliente.length === 0) {
    return 0;
  }

  await trx('entidade_notas').insert(notasCliente.map(nota => ({
    entidade_tipo: 'venda',
    entidade_id: Number(vendaId),
    usuario_id: nota.usuario_id,
    titulo: nota.titulo,
    conteudo: nota.conteudo,
    created_at: createdAt,
    updated_at: createdAt
  })));

  return notasCliente.length;
}

function parseValorMonetario(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;

  if (typeof valor === 'number') {
    return valor;
  }

  const texto = String(valor)
    .replace(/\s/g, '')
    .replace(/^R\$/i, '');

  if (texto.includes(',')) {
    return Number(texto.replace(/\./g, '').replace(',', '.')) || 0;
  }

  return Number(texto) || 0;
}

function normalizarGigas(valor) {
  return String(valor || '').trim().slice(0, 40);
}

function normalizarItensChips(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    return valor
      .map(item => ({
        quantidade: Number(item.quantidade || 0),
        gb: normalizarGigas(item.gb),
        valor_unitario: parseValorMonetario(item.valor_unitario)
      }))
      .filter(item => item.quantidade > 0 && item.valor_unitario > 0);
  }

  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return normalizarItensChips(parsed);
    } catch {
      return valor
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean)
        .map(linha => {
          const match = linha.match(/^(\d+)\s*x\s*([\d.,]+)$/i);

          if (!match) return null;

          return {
            quantidade: Number(match[1]),
            gb: '',
            valor_unitario: parseValorMonetario(match[2])
          };
        })
        .filter(Boolean);
    }
  }

  return [];
}

function calcularTotalChips(itens) {
  const total = itens.reduce((acc, item) => {
    return acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0));
  }, 0);

  return Number(total.toFixed(2));
}

function resumirGigasItensChips(itens) {
  return Array.from(new Set(
    itens
      .map(item => normalizarGigas(item.gb))
      .filter(Boolean)
  )).join(', ');
}

function montarPayload(dados) {
  const payload = {};

  CAMPOS.forEach((campo) => {
    const valor = limparValor(dados[campo]);

    if (valor !== undefined) {
      payload[campo] = valor;
    }
  });

  if (payload.nome !== undefined && payload.nome !== null) {
    payload.nome = String(payload.nome).trim();
  }

  if (payload.vendedora_id !== undefined && payload.vendedora_id !== null) {
    payload.vendedora_id = Number(payload.vendedora_id);
  }

  if (payload.operadora_id !== undefined && payload.operadora_id !== null) {
    payload.operadora_id = Number(payload.operadora_id);
  }

  if (payload.plano_id !== undefined && payload.plano_id !== null) {
    payload.plano_id = Number(payload.plano_id);
  }

  if (payload.cliente_id !== undefined && payload.cliente_id !== null) {
    payload.cliente_id = Number(payload.cliente_id);
  }

  if (payload.tipo_venda_id !== undefined && payload.tipo_venda_id !== null) {
    payload.tipo_venda_id = Number(payload.tipo_venda_id);
  }

  if (payload.servico_id !== undefined && payload.servico_id !== null) {
    payload.servico_id = Number(payload.servico_id);
  }

  if (payload.quantidade_linhas !== undefined && payload.quantidade_linhas !== null) {
    payload.quantidade_linhas = Number(payload.quantidade_linhas);
  }

  if (payload.dia_vencimento !== undefined && payload.dia_vencimento !== null) {
    payload.dia_vencimento = Number(payload.dia_vencimento);
  }

  const itensChips = normalizarItensChips(dados.valores_unitarios_chips);

  if (dados.valores_unitarios_chips !== undefined) {
    payload.valores_unitarios_chips = itensChips.length > 0 ? JSON.stringify(itensChips) : null;
    payload.valor_total = calcularTotalChips(itensChips);
    payload.gb = resumirGigasItensChips(itensChips) || payload.gb || null;
  }

  if (payload.data_venda !== undefined) {
    payload.data_venda = normalizarData(payload.data_venda);
  }

  if (payload.prioridade_funil !== undefined) {
    const prioridadeNormalizada = String(payload.prioridade_funil || '').trim().toLowerCase();
    payload.prioridade_funil = FUNIL_PRIORIDADES.includes(prioridadeNormalizada)
      ? prioridadeNormalizada
      : 'media';
  }

  return payload;
}

function aplicarDadosClienteNaVenda(payload, cliente) {
  if (!cliente) {
    return payload;
  }

  const telefoneWhatsapp = [cliente.whatsapp_ddd, cliente.whatsapp_numero]
    .filter(Boolean)
    .join('');
  const telefoneFixo = [cliente.fixo_ddd, cliente.fixo_numero]
    .filter(Boolean)
    .join('');

  return {
    ...payload,
    nome: payload.nome || cliente.nome,
    razao_social: payload.razao_social || cliente.razao_social,
    cnpj: payload.cnpj || cliente.cnpj,
    email: payload.email || cliente.email,
    telefone: payload.telefone || telefoneWhatsapp || null,
    fixo_ddd: payload.fixo_ddd || telefoneFixo || null,
    nome_representante_legal: payload.nome_representante_legal || (
      cliente.responsavel_tipo === 'rl' ? cliente.responsavel_nome : null
    ),
    nome_administrador: payload.nome_administrador || (
      cliente.responsavel_tipo === 'adm' ? cliente.responsavel_nome : null
    ),
    quantidade_linhas: payload.quantidade_linhas || cliente.quantidade_chips
  };
}

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

async function buscarEscopoVendas(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return { podeVerTodas: false, podeVerProprias: false };
  }

  if (usuario.role?.nome === 'admin') {
    return { podeVerTodas: true, podeVerProprias: true };
  }

  const permissoes = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return {
    podeVerTodas: permissoes.includes('vendas_ver_todas'),
    podeVerProprias: permissoes.includes('vendas_ver_proprias')
  };
}

function aplicarEscopoVendas(query, usuarioId, escopo, alias = '') {
  const campo = (nome) => alias ? `${alias}.${nome}` : nome;

  if (escopo.podeVerTodas) {
    return query;
  }

  if (!escopo.podeVerProprias) {
    query.whereRaw('1 = 0');
    return query;
  }

  query.where((builder) => {
    builder
      .where(campo('criado_por_id'), usuarioId)
      .orWhere(campo('vendedora_id'), usuarioId);
  });

  return query;
}

function dataReferenciaVendaSQL(alias = 'v') {
  return `COALESCE(NULLIF(NULLIF(${alias}.data_venda, '0000-00-00'), '1899-11-30'), NULLIF(DATE(${alias}.criado_em), '0000-00-00'), DATE(${alias}.created_at))`;
}

function formatarDataISO(data) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0')
  ].join('-');
}

function adicionarDias(data, dias) {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + dias);
  return novaData;
}

function resolverPeriodoRelatorio(filtros = {}) {
  const hoje = new Date();
  const periodo = filtros.periodo || 'mes_atual';
  let inicio;
  let fim;

  if (periodo === 'hoje') {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    fim = inicio;
  } else if (periodo === 'semana_atual') {
    const diaSemana = hoje.getDay();
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    inicio = adicionarDias(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), -diasDesdeSegunda);
    fim = hoje;
  } else if (periodo === 'ultimos_30_dias') {
    inicio = adicionarDias(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), -29);
    fim = hoje;
  } else if (periodo === 'personalizado') {
    const inicioCustom = normalizarData(filtros.data_inicio);
    const fimCustom = normalizarData(filtros.data_fim);

    inicio = inicioCustom ? new Date(`${inicioCustom}T00:00:00`) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = fimCustom ? new Date(`${fimCustom}T00:00:00`) : hoje;
  } else {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = hoje;
  }

  if (inicio > fim) {
    const temporaria = inicio;
    inicio = fim;
    fim = temporaria;
  }

  return {
    tipo: periodo,
    dataInicio: formatarDataISO(inicio),
    dataFim: formatarDataISO(fim),
    dataFimExclusiva: formatarDataISO(adicionarDias(fim, 1))
  };
}

function obterQuantidadeChipsVenda(venda) {
  let totalItens = 0;

  if (Array.isArray(venda.valores_unitarios_chips)) {
    totalItens = venda.valores_unitarios_chips.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  } else if (typeof venda.valores_unitarios_chips === 'string' && venda.valores_unitarios_chips.trim()) {
    try {
      const itens = JSON.parse(venda.valores_unitarios_chips);
      totalItens = Array.isArray(itens)
        ? itens.reduce((total, item) => total + Number(item.quantidade || 0), 0)
        : 0;
    } catch {
      totalItens = normalizarItensChips(venda.valores_unitarios_chips)
        .reduce((total, item) => total + Number(item.quantidade || 0), 0);
    }
  }

  if (totalItens > 0) {
    return totalItens;
  }

  const quantidadeLinhas = Number(venda.quantidade_linhas || 0);

  return quantidadeLinhas > 0 ? quantidadeLinhas : 1;
}

function somarValorVendas(vendas = []) {
  return Number(vendas.reduce((total, venda) => total + Number(venda.valor_total || 0), 0).toFixed(2));
}

function montarResumoAgrupado(mapa) {
  return Array.from(mapa.values())
    .map(item => ({
      ...item,
      valor: Number(item.valor.toFixed(2))
    }))
    .sort((a, b) => b.valor - a.valor);
}

function montarResumoFases(vendas = []) {
  const statusEncontrados = Array.from(new Set(
    vendas
      .map(venda => venda.status_funil || 'aprovacao')
      .filter(Boolean)
  ));
  const statusOrdenados = [
    ...FUNIL_STATUS,
    ...statusEncontrados.filter(status => !FUNIL_STATUS.includes(status))
  ];
  const fasesMap = new Map(statusOrdenados.map(status => [
    status,
    {
      id: status,
      nome: FUNIL_STATUS_LABELS[status] || status,
      valor: 0,
      vendas: 0,
      chips: 0,
      retorno: status === 'retorno'
    }
  ]));

  vendas.forEach(venda => {
    const status = venda.status_funil || 'aprovacao';
    const fase = fasesMap.get(status) || {
      id: status,
      nome: FUNIL_STATUS_LABELS[status] || status,
      valor: 0,
      vendas: 0,
      chips: 0,
      retorno: status === 'retorno'
    };

    fase.valor += Number(venda.valor_total || 0);
    fase.vendas += 1;
    fase.chips += obterQuantidadeChipsVenda(venda);
    fasesMap.set(status, fase);
  });

  return Array.from(fasesMap.values()).map(fase => ({
    ...fase,
    valor: Number(fase.valor.toFixed(2))
  }));
}

async function listarEtapasFunilOrdenadas() {
  try {
    const etapas = await FunilEtapa.query()
      .where('ativo', true)
      .orderBy('ordem', 'asc')
      .orderBy('nome', 'asc');

    if (etapas.length > 0) {
      return etapas.map(etapa => ({
        id: etapa.codigo,
        nome: etapa.nome,
        ordem: etapa.ordem,
        retorno: false
      }));
    }
  } catch {
    return FUNIL_STATUS
      .filter(status => status !== 'retorno')
      .map((status, index) => ({
        id: status,
        nome: FUNIL_STATUS_LABELS[status] || status,
        ordem: index + 1,
        retorno: false
      }));
  }

  return FUNIL_STATUS
    .filter(status => status !== 'retorno')
    .map((status, index) => ({
      id: status,
      nome: FUNIL_STATUS_LABELS[status] || status,
      ordem: index + 1,
      retorno: false
    }));
}

async function montarResumoFasesDinamico(vendas = []) {
  const etapas = await listarEtapasFunilOrdenadas();
  const statusBase = [...etapas.map(etapa => etapa.id), 'retorno'];
  const statusEncontrados = Array.from(new Set(
    vendas
      .map(venda => venda.status_funil || etapas[0]?.id || 'aprovacao')
      .filter(Boolean)
  ));
  const statusOrdenados = [
    ...statusBase,
    ...statusEncontrados.filter(status => !statusBase.includes(status))
  ];
  const nomes = {
    ...FUNIL_STATUS_LABELS,
    ...Object.fromEntries(etapas.map(etapa => [etapa.id, etapa.nome]))
  };
  const fasesMap = new Map(statusOrdenados.map(status => [
    status,
    {
      id: status,
      nome: nomes[status] || status,
      valor: 0,
      vendas: 0,
      chips: 0,
      retorno: status === 'retorno'
    }
  ]));

  vendas.forEach(venda => {
    const status = venda.status_funil || etapas[0]?.id || 'aprovacao';
    const fase = fasesMap.get(status) || {
      id: status,
      nome: nomes[status] || status,
      valor: 0,
      vendas: 0,
      chips: 0,
      retorno: status === 'retorno'
    };

    fase.valor += Number(venda.valor_total || 0);
    fase.vendas += 1;
    fase.chips += obterQuantidadeChipsVenda(venda);
    fasesMap.set(status, fase);
  });

  return Array.from(fasesMap.values()).map(fase => ({
    ...fase,
    valor: Number(fase.valor.toFixed(2))
  }));
}

async function usuarioPodeAcessarVenda(id, usuarioId, opcoes = {}) {
  const escopo = await buscarEscopoVendas(usuarioId);

  if (escopo.podeVerTodas) {
    return true;
  }

  if (!escopo.podeVerProprias) {
    return false;
  }

  const query = Venda.query()
    .findById(id)
    .select('id', 'criado_por_id', 'vendedora_id');

  if (!opcoes.incluirLixeira) {
    query.whereNull('excluido_em');
  }

  const venda = await query;

  return Number(venda?.criado_por_id) === Number(usuarioId)
    || Number(venda?.vendedora_id) === Number(usuarioId);
}

async function listarVendas(filtros = {}, usuarioId) {
  const escopo = await buscarEscopoVendas(usuarioId);
  const query = Venda.query()
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, plano.operadora, criador, historico.usuario]')
    .modifyGraph('vendedora', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .modifyGraph('historico', builder => builder.orderBy('created_at', 'desc').orderBy('id', 'desc'))
    .modifyGraph('historico.usuario', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .whereNull('excluido_em')
    .orderBy('data_venda', 'desc')
    .orderBy('id', 'desc');

  aplicarEscopoVendas(query, usuarioId, escopo);

  if (filtros.busca) {
    const busca = `%${filtros.busca}%`;

    query.where((builder) => {
      builder
        .where('nome', 'like', busca)
        .orWhere('telefone', 'like', busca)
        .orWhere('email', 'like', busca)
        .orWhere('produto_fechado', 'like', busca)
        .orWhere('razao_social', 'like', busca)
        .orWhere('cnpj', 'like', busca)
        .orWhere('municipio', 'like', busca);
    });
  }

  if (filtros.vendedora_id) {
    query.where('vendedora_id', Number(filtros.vendedora_id));
  }

  if (filtros.operadora_id) {
    query.where('operadora_id', Number(filtros.operadora_id));
  }

  if (filtros.tipo_venda_id) {
    query.where('tipo_venda_id', Number(filtros.tipo_venda_id));
  }

  if (filtros.servico_id) {
    query.where('servico_id', Number(filtros.servico_id));
  }

  if (filtros.status_funil) {
    query.where('status_funil', filtros.status_funil);
  }

  if (filtros.data_inicio) {
    query.where('data_venda', '>=', normalizarData(filtros.data_inicio));
  }

  if (filtros.data_fim) {
    query.where('data_venda', '<=', normalizarData(filtros.data_fim));
  }

  if (filtros.valor_min) {
    query.where('valor_total', '>=', parseValorMonetario(filtros.valor_min));
  }

  if (filtros.valor_max) {
    query.where('valor_total', '<=', parseValorMonetario(filtros.valor_max));
  }

  return query;
}

async function obterResumoDashboard(usuarioId) {
  const escopo = await buscarEscopoVendas(usuarioId);
  const dataReferencia = dataReferenciaVendaSQL('v');
  const hoje = new Date();
  const inicioHoje = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0')
  ].join('-');

  const queryHoje = Venda.query().alias('v');
  aplicarEscopoVendas(queryHoje, usuarioId, escopo, 'v');

  const vendasHoje = await queryHoje
    .whereNull('v.excluido_em')
    .whereNot('v.status_funil', 'retorno')
    .whereRaw(`${dataReferencia} = ?`, [inicioHoje])
    .select(
      Venda.raw('COUNT(*) as vendas_dia'),
      Venda.raw('COALESCE(SUM(COALESCE(v.valor_total, 0)), 0) as valor_dia'),
      Venda.raw("SUM(CASE WHEN v.status_funil = 'concluido' THEN 1 ELSE 0 END) as concluidas_dia")
    )
    .first();

  const queryPipeline = Venda.query().alias('v');
  aplicarEscopoVendas(queryPipeline, usuarioId, escopo, 'v');

  const pipeline = await queryPipeline
    .whereNull('v.excluido_em')
    .whereNotIn('v.status_funil', ['concluido', 'retorno'])
    .select(
      Venda.raw('COUNT(*) as pipeline_count'),
      Venda.raw('COALESCE(SUM(COALESCE(v.valor_total, 0)), 0) as pipeline')
    )
    .first();

  const queryRetornos = Venda.query().alias('v');
  aplicarEscopoVendas(queryRetornos, usuarioId, escopo, 'v');

  const retornos = await queryRetornos
    .whereNull('v.excluido_em')
    .where('v.status_funil', 'retorno')
    .select(
      'v.id',
      'v.valor_total',
      'v.valores_unitarios_chips',
      'v.quantidade_linhas'
    );

  const chipsRetornados = retornos.reduce((total, venda) => total + obterQuantidadeChipsVenda(venda), 0);
  const perdaRetornos = retornos.reduce((total, venda) => total + Number(venda.valor_total || 0), 0);

  return {
    vendasDia: Number(vendasHoje?.vendas_dia || 0),
    valorDia: Number(vendasHoje?.valor_dia || 0),
    concluidasDia: Number(vendasHoje?.concluidas_dia || 0),
    pipeline: Number(pipeline?.pipeline || 0),
    pipelineCount: Number(pipeline?.pipeline_count || 0),
    retornos: chipsRetornados,
    perda: Number(perdaRetornos.toFixed(2))
  };
}

async function obterRelatoriosVendas(filtros = {}) {
  const periodo = resolverPeriodoRelatorio(filtros);
  const dataReferencia = dataReferenciaVendaSQL('v');
  const vendedoraId = filtros.vendedora_id ? Number(filtros.vendedora_id) : null;

  const query = Venda.query()
    .alias('v')
    .leftJoin('operadoras as o', 'v.operadora_id', 'o.id')
    .leftJoin('usuarios as u', 'v.vendedora_id', 'u.id')
    .whereNull('v.excluido_em')
    .whereRaw(`${dataReferencia} >= ?`, [periodo.dataInicio])
    .whereRaw(`${dataReferencia} < ?`, [periodo.dataFimExclusiva])
    .select(
      'v.id',
      'v.status_funil',
      'v.valor_total',
      'v.valores_unitarios_chips',
      'v.quantidade_linhas',
      'v.operadora_id',
      'v.vendedora_id',
      'o.nome as operadora_nome',
      'u.nome as vendedora_nome',
      'u.email as vendedora_email'
    );

  if (vendedoraId) {
    query.where('v.vendedora_id', vendedoraId);
  }

  const vendas = await query;
  const vendasAndamento = vendas.filter(venda => !['concluido', 'retorno'].includes(venda.status_funil));
  const vendasConcluidas = vendas.filter(venda => venda.status_funil === 'concluido');
  const vendasRetorno = vendas.filter(venda => venda.status_funil === 'retorno');
  const vendasValidas = vendas.filter(venda => venda.status_funil !== 'retorno');
  const chipsRetornados = vendasRetorno.reduce((total, venda) => total + obterQuantidadeChipsVenda(venda), 0);
  const chipsVendidos = vendas.reduce((total, venda) => total + obterQuantidadeChipsVenda(venda), 0);
  const porOperadoraMap = new Map();
  const rankingMap = new Map();

  vendasValidas.forEach(venda => {
    const valor = Number(venda.valor_total || 0);
    const chips = obterQuantidadeChipsVenda(venda);
    const operadoraId = venda.operadora_id ? Number(venda.operadora_id) : null;
    const chaveOperadora = operadoraId || 'sem_operadora';
    const operadoraAtual = porOperadoraMap.get(chaveOperadora) || {
      id: operadoraId,
      nome: venda.operadora_nome || 'Sem operadora',
      valor: 0,
      vendas: 0,
      chips: 0
    };

    operadoraAtual.valor += valor;
    operadoraAtual.vendas += 1;
    operadoraAtual.chips += chips;
    porOperadoraMap.set(chaveOperadora, operadoraAtual);

    const vendedorId = venda.vendedora_id ? Number(venda.vendedora_id) : null;
    const chaveVendedor = vendedorId || 'sem_vendedor';
    const vendedorAtual = rankingMap.get(chaveVendedor) || {
      id: vendedorId,
      nome: venda.vendedora_nome || 'Sem vendedor',
      email: venda.vendedora_email || '',
      valor: 0,
      vendas: 0,
      chips: 0
    };

    vendedorAtual.valor += valor;
    vendedorAtual.vendas += 1;
    vendedorAtual.chips += chips;
    rankingMap.set(chaveVendedor, vendedorAtual);
  });

  return {
    periodo: {
      tipo: periodo.tipo,
      data_inicio: periodo.dataInicio,
      data_fim: periodo.dataFim
    },
    filtros: {
      vendedora_id: vendedoraId
    },
    cards: {
      vendasAndamento: {
        quantidade: vendasAndamento.length,
        valor: somarValorVendas(vendasAndamento)
      },
      concluidas: {
        quantidade: vendasConcluidas.length,
        valor: somarValorVendas(vendasConcluidas)
      },
      perdaRetorno: {
        quantidade: vendasRetorno.length,
        valor: somarValorVendas(vendasRetorno),
        chips: chipsRetornados
      },
      taxaRetorno: {
        percentual: chipsVendidos > 0 ? Number(((chipsRetornados / chipsVendidos) * 100).toFixed(1)) : 0,
        chipsRetornados,
        chipsVendidos
      }
    },
    vendasPorFase: await montarResumoFasesDinamico(vendas),
    porOperadora: montarResumoAgrupado(porOperadoraMap),
    rankingVendedores: montarResumoAgrupado(rankingMap)
  };
}

async function buscarVendaPorId(id, usuarioId) {
  const escopo = usuarioId ? await buscarEscopoVendas(usuarioId) : { podeVerTodas: true };
  const query = Venda.query()
    .findById(id)
    .whereNull('excluido_em')
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, plano.operadora, criador, historico.usuario]')
    .modifyGraph('vendedora', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .modifyGraph('historico', builder => builder.orderBy('created_at', 'desc').orderBy('id', 'desc'))
    .modifyGraph('historico.usuario', builder => builder.select('id', 'nome', 'email', 'foto_perfil'));

  if (usuarioId) {
    aplicarEscopoVendas(query, usuarioId, escopo);
  }

  return query;
}

async function criarVenda(dados, usuarioId) {
  const agora = formatarDateTimeSQL();
  let payload = montarPayload(dados);

  if (payload.cliente_id) {
    const cliente = await clienteService.buscarClientePorId(payload.cliente_id, usuarioId);

    if (!cliente) {
      throw new Error('Cliente não encontrado.');
    }

    payload = aplicarDadosClienteNaVenda(payload, cliente);
  }

  return Venda.transaction(async trx => {
    const venda = await Venda.query(trx).insertAndFetch({
      ...payload,
      criado_por_id: usuarioId,
      criado_em: agora,
      ultima_atividade_em: agora
    });

    await registrarHistoricoVenda({
      vendaId: venda.id,
      usuarioId,
      acao: 'venda.criada',
      statusNovo: venda.status_funil || 'aprovacao',
      observacao: 'Venda cadastrada',
      dados: {
        venda_id: venda.id,
        status_funil: venda.status_funil || 'aprovacao'
      },
      createdAt: agora,
      trx
    });

    if (payload.cliente_id) {
      await copiarNotasClienteParaVenda({
        clienteId: payload.cliente_id,
        vendaId: venda.id,
        createdAt: agora,
        trx
      });
    }

    return venda;
  });
}

async function atualizarVenda(id, dados, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(id, usuarioId);

  if (!permitido) {
    return null;
  }

  const agora = formatarDateTimeSQL();
  let payload = montarPayload(dados);

  if (payload.cliente_id) {
    const cliente = await clienteService.buscarClientePorId(payload.cliente_id, usuarioId);

    if (!cliente) {
      throw new Error('Cliente não encontrado.');
    }

    payload = aplicarDadosClienteNaVenda(payload, cliente);
  }

  return Venda.query().patchAndFetchById(id, {
    ...payload,
    ultima_atividade_em: agora,
    updated_at: agora
  });
}

async function validarStatusFunil(status) {
  if (status === 'retorno') {
    return true;
  }

  const etapas = await listarEtapasFunilOrdenadas();
  return etapas.some(etapa => etapa.id === status);
}

async function atualizarStatusVenda(id, dados, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(id, usuarioId);

  if (!permitido) {
    return { status: 'not_found' };
  }

  const venda = await Venda.query().findById(id);

  if (!venda || venda.excluido_em) {
    return { status: 'not_found' };
  }

  const agora = formatarDateTimeSQL();
  const status = dados.status_funil;
  const observacao = String(dados.observacao || '').trim();
  const prioridadeInformada = dados.prioridade_funil !== undefined
    ? String(dados.prioridade_funil || '').trim().toLowerCase()
    : undefined;
  const prioridade = prioridadeInformada === undefined
    ? venda.prioridade_funil || 'media'
    : prioridadeInformada;

  const retornoVoltandoParaOrigem = venda.status_funil === 'retorno' && status === (venda.status_anterior_retorno || 'aprovacao');

  if (!retornoVoltandoParaOrigem && !await validarStatusFunil(status)) {
    return { status: 'invalid', message: 'Status do funil inválido.' };
  }

  if (!FUNIL_PRIORIDADES.includes(prioridade)) {
    return { status: 'invalid', message: 'Prioridade do funil invalida.' };
  }

  if (status === 'retorno') {
    const motivo = String(dados.motivo_retorno || venda.motivo_retorno || '').trim();

    if (!motivo) {
      return { status: 'invalid', message: 'Informe o motivo do retorno.' };
    }

    if (venda.status_funil === 'retorno') {
      const vendaAtualizada = await Venda.transaction(async trx => {
        const atualizada = await Venda.query(trx).patchAndFetchById(id, {
          motivo_retorno: motivo,
          prioridade_funil: prioridade,
          ultima_atividade_em: agora,
          updated_at: agora
        });

        await registrarHistoricoVenda({
          vendaId: id,
          usuarioId,
          acao: 'venda.retorno_observacao_atualizada',
          statusAnterior: 'retorno',
          statusNovo: 'retorno',
          observacao: observacao || null,
          dados: {
            motivo_retorno: motivo,
            observacao
          },
          createdAt: agora,
          trx
        });

        return atualizada;
      });

      return { status: 'ok', venda: vendaAtualizada };
    }

    const statusAnterior = venda.status_funil && venda.status_funil !== 'retorno'
      ? venda.status_funil
      : (venda.status_anterior_retorno || 'aprovacao');

    const vendaAtualizada = await Venda.transaction(async trx => {
      const atualizada = await Venda.query(trx).patchAndFetchById(id, {
        status_funil: 'retorno',
        prioridade_funil: prioridade,
        status_anterior_retorno: statusAnterior,
        motivo_retorno: motivo,
        nota_correcao_retorno: null,
        retornou_em: agora,
        corrigido_em: null,
        ultima_atividade_em: agora,
        updated_at: agora
      });

      await registrarHistoricoVenda({
        vendaId: id,
        usuarioId,
        acao: 'venda.retorno_registrado',
        statusAnterior,
        statusNovo: 'retorno',
        observacao: observacao || motivo,
        dados: {
          motivo_retorno: motivo,
          observacao
        },
        createdAt: agora,
        trx
      });

      return atualizada;
    });

    return { status: 'ok', venda: vendaAtualizada };
  }

  if (venda.status_funil === 'retorno') {
    const nota = String(dados.nota_correcao_retorno || '').trim();

    if (!nota) {
      return { status: 'invalid', message: 'Informe o que foi corrigido.' };
    }

    const destino = venda.status_anterior_retorno || 'aprovacao';

    const vendaAtualizada = await Venda.transaction(async trx => {
      const atualizada = await Venda.query(trx).patchAndFetchById(id, {
        status_funil: destino,
        prioridade_funil: prioridade,
        nota_correcao_retorno: nota,
        corrigido_em: agora,
        ultima_atividade_em: agora,
        updated_at: agora
      });

      await registrarHistoricoVenda({
        vendaId: id,
        usuarioId,
        acao: 'venda.retorno_corrigido',
        statusAnterior: 'retorno',
        statusNovo: destino,
        observacao: nota,
        dados: {
          nota_correcao_retorno: nota
        },
        createdAt: agora,
        trx
      });

      return atualizada;
    });

    return { status: 'ok', venda: vendaAtualizada };
  }

  const vendaAtualizada = await Venda.transaction(async trx => {
    const atualizada = await Venda.query(trx).patchAndFetchById(id, {
      status_funil: status,
      prioridade_funil: prioridade,
      ultima_atividade_em: agora,
      updated_at: agora
    });

    await registrarHistoricoVenda({
      vendaId: id,
      usuarioId,
      acao: status !== venda.status_funil
        ? 'venda.status_atualizado'
        : prioridade !== (venda.prioridade_funil || 'media')
          ? 'venda.prioridade_atualizada'
          : 'venda.observacao_adicionada',
      statusAnterior: venda.status_funil || null,
      statusNovo: status,
      observacao: observacao || null,
      dados: {
        status_funil: status,
        status_anterior: venda.status_funil || null,
        prioridade_funil: prioridade,
        prioridade_anterior: venda.prioridade_funil || 'media',
        observacao
      },
      createdAt: agora,
      trx
    });

    return atualizada;
  });

  return { status: 'ok', venda: vendaAtualizada };
}

async function excluirVenda(id, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(id, usuarioId);

  if (!permitido) {
    return 0;
  }

  const agora = new Date();

  return Venda.knex()('vendas')
    .where('id', id)
    .whereNull('excluido_em')
    .update({
      excluido_em: formatarDateTimeSQL(agora),
      excluir_definitivo_em: formatarDateTimeSQL(adicionarUmMes(agora)),
      excluido_por_id: usuarioId,
      updated_at: formatarDateTimeSQL(agora)
    });
}

function adicionarUmMes(data = new Date()) {
  const proxima = new Date(data);
  proxima.setMonth(proxima.getMonth() + 1);
  return proxima;
}

async function limparVendasVencidasDaLixeira() {
  return Venda.knex()('vendas')
    .whereNotNull('excluido_em')
    .where('excluir_definitivo_em', '<=', formatarDateTimeSQL())
    .delete();
}

async function listarVendasLixeira(filtros = {}, usuarioId) {
  await limparVendasVencidasDaLixeira();

  const escopo = await buscarEscopoVendas(usuarioId);
  const query = Venda.query()
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, criador, excluidoPor]')
    .modifyGraph('vendedora', builder => builder.select('id', 'nome', 'email', 'foto_perfil'))
    .whereNotNull('excluido_em')
    .orderBy('excluido_em', 'desc')
    .orderBy('id', 'desc');

  aplicarEscopoVendas(query, usuarioId, escopo);

  if (filtros.busca) {
    const busca = `%${filtros.busca}%`;

    query.where((builder) => {
      builder
        .where('nome', 'like', busca)
        .orWhere('telefone', 'like', busca)
        .orWhere('email', 'like', busca)
        .orWhere('produto_fechado', 'like', busca)
        .orWhere('razao_social', 'like', busca)
        .orWhere('cnpj', 'like', busca)
        .orWhere('municipio', 'like', busca);
    });
  }

  if (filtros.vendedora_id) {
    query.where('vendedora_id', Number(filtros.vendedora_id));
  }

  return query;
}

async function restaurarVenda(id, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return null;
  }

  const atualizados = await Venda.knex()('vendas')
    .where('id', id)
    .whereNotNull('excluido_em')
    .update({
      excluido_em: null,
      excluir_definitivo_em: null,
      excluido_por_id: null,
      updated_at: formatarDateTimeSQL()
    });

  if (!atualizados) {
    return null;
  }

  return buscarVendaPorId(id, usuarioId);
}

async function excluirVendaDefinitivo(id, usuarioId) {
  const permitido = await usuarioPodeAcessarVenda(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return 0;
  }

  return Venda.knex()('vendas')
    .where('id', id)
    .whereNotNull('excluido_em')
    .delete();
}

async function listarVendedoras() {
  return Usuario.query()
    .select('id', 'nome', 'email', 'ativo')
    .where('ativo', true)
    .orderBy('nome', 'asc');
}

module.exports = {
  listarVendas,
  listarVendasLixeira,
  obterResumoDashboard,
  obterRelatoriosVendas,
  buscarVendaPorId,
  criarVenda,
  atualizarVenda,
  atualizarStatusVenda,
  excluirVenda,
  restaurarVenda,
  excluirVendaDefinitivo,
  listarVendedoras
};
