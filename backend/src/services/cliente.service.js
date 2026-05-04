const Cliente = require('../models/Cliente');
const Usuario = require('../models/Usuario');

const CAMPOS = [
  'nome',
  'razao_social',
  'cnpj',
  'responsavel_tipo',
  'responsavel_nome',
  'email',
  'whatsapp_ddd',
  'whatsapp_numero',
  'fixo_ddd',
  'fixo_numero',
  'fidelidade_fim',
  'operadora_atual_id',
  'quantidade_chips'
];

function limparValor(valor) {
  if (valor === undefined) return undefined;
  if (valor === '') return null;
  return valor;
}

function normalizarData(valor) {
  if (!valor) return null;

  const texto = String(valor).trim();

  if (!texto || texto === '1899-11-30' || texto === '30/11/1899') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (!match) return null;

  const [, dia, mes, ano] = match;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

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

function adicionarUmMes(data = new Date()) {
  const proxima = new Date(data);
  proxima.setMonth(proxima.getMonth() + 1);
  return proxima;
}

function separarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) {
    return { ddd: null, numero: null };
  }

  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function montarPayload(dados) {
  const dadosNormalizados = { ...dados };

  if (dados.whatsapp !== undefined) {
    const whatsapp = separarTelefone(dados.whatsapp);
    dadosNormalizados.whatsapp_ddd = whatsapp.ddd;
    dadosNormalizados.whatsapp_numero = whatsapp.numero;
  }

  if (dados.fixo !== undefined) {
    const fixo = separarTelefone(dados.fixo);
    dadosNormalizados.fixo_ddd = fixo.ddd;
    dadosNormalizados.fixo_numero = fixo.numero;
  }

  const payload = {};

  CAMPOS.forEach((campo) => {
    const valor = limparValor(dadosNormalizados[campo]);

    if (valor !== undefined) {
      payload[campo] = valor;
    }
  });

  if (payload.nome !== undefined && payload.nome !== null) {
    payload.nome = String(payload.nome).trim();
  }

  if (!payload.responsavel_tipo) {
    payload.responsavel_tipo = 'rl';
  }

  if (!['adm', 'rl'].includes(payload.responsavel_tipo)) {
    throw new Error('Tipo do responsável inválido.');
  }

  if (payload.operadora_atual_id !== undefined && payload.operadora_atual_id !== null) {
    payload.operadora_atual_id = Number(payload.operadora_atual_id);
  }

  if (payload.quantidade_chips !== undefined && payload.quantidade_chips !== null) {
    payload.quantidade_chips = Number(payload.quantidade_chips);
  }

  if (payload.fidelidade_fim !== undefined) {
    payload.fidelidade_fim = normalizarData(payload.fidelidade_fim);
  }

  return payload;
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

async function buscarEscopoClientes(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario || !usuario.ativo) {
    return { podeVerTodos: false, podeVerProprios: false };
  }

  if (usuario.role?.nome === 'admin') {
    return { podeVerTodos: true, podeVerProprios: true };
  }

  const permissoes = [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ];

  return {
    podeVerTodos: permissoes.includes('clientes_ver_todos'),
    podeVerProprios: permissoes.includes('clientes_ver_proprios')
  };
}

function aplicarEscopoClientes(query, usuarioId, escopo) {
  if (escopo.podeVerTodos) {
    return query;
  }

  if (!escopo.podeVerProprios) {
    query.whereRaw('1 = 0');
    return query;
  }

  query.where('criado_por_id', usuarioId);
  return query;
}

function montarAvisoFidelidade(cliente) {
  if (!cliente.fidelidade_fim || cliente.fidelidade_fim === '1899-11-30') {
    return null;
  }

  const hoje = new Date();
  const fim = new Date(cliente.fidelidade_fim);
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);

  if (![30, 10, 0].includes(diasRestantes)) {
    return {
      dias_restantes: diasRestantes,
      deve_avisar: false,
      nivel: null
    };
  }

  return {
    dias_restantes: diasRestantes,
    deve_avisar: true,
    nivel: diasRestantes === 0 ? 'hoje' : `${diasRestantes}_dias`
  };
}

function formatarCliente(cliente) {
  if (!cliente) return cliente;

  const json = typeof cliente.toJSON === 'function' ? cliente.toJSON() : cliente;

  return {
    ...json,
    aviso_fidelidade: montarAvisoFidelidade(json)
  };
}

async function listarClientes(filtros = {}, usuarioId) {
  const escopo = await buscarEscopoClientes(usuarioId);
  const query = Cliente.query()
    .withGraphFetched('[operadoraAtual, criador]')
    .whereNull('excluido_em')
    .orderBy('nome', 'asc');

  aplicarEscopoClientes(query, usuarioId, escopo);

  if (filtros.busca) {
    const busca = `%${filtros.busca}%`;

    query.where((builder) => {
      builder
        .where('nome', 'like', busca)
        .orWhere('razao_social', 'like', busca)
        .orWhere('cnpj', 'like', busca)
        .orWhere('email', 'like', busca)
        .orWhere('responsavel_nome', 'like', busca);
    });
  }

  if (filtros.operadora_atual_id) {
    query.where('operadora_atual_id', Number(filtros.operadora_atual_id));
  }

  if (['adm', 'rl'].includes(filtros.responsavel_tipo)) {
    query.where('responsavel_tipo', filtros.responsavel_tipo);
  }

  if (filtros.chips_min) {
    query.where('quantidade_chips', '>=', Number(filtros.chips_min));
  }

  if (filtros.chips_max) {
    query.where('quantidade_chips', '<=', Number(filtros.chips_max));
  }

  const clientes = (await query).map(formatarCliente);

  if (filtros.avisos_fidelidade) {
    return clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar);
  }

  if (filtros.fidelidade === 'sem') {
    return clientes.filter(cliente => !cliente.fidelidade_fim);
  }

  if (filtros.fidelidade === 'vencida') {
    return clientes.filter(cliente => cliente.aviso_fidelidade?.dias_restantes < 0);
  }

  if (filtros.fidelidade === 'ativa') {
    return clientes.filter(cliente => cliente.aviso_fidelidade?.dias_restantes >= 0);
  }

  if (filtros.fidelidade === 'alerta') {
    return clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar);
  }

  return clientes;
}

async function buscarClientePorId(id, usuarioId) {
  const escopo = usuarioId ? await buscarEscopoClientes(usuarioId) : { podeVerTodos: true };
  const query = Cliente.query()
    .findById(id)
    .whereNull('excluido_em')
    .withGraphFetched('[operadoraAtual, criador]');

  if (usuarioId) {
    aplicarEscopoClientes(query, usuarioId, escopo);
  }

  return formatarCliente(await query);
}

async function usuarioPodeAcessarCliente(id, usuarioId, opcoes = {}) {
  const escopo = await buscarEscopoClientes(usuarioId);

  if (escopo.podeVerTodos) {
    return true;
  }

  if (!escopo.podeVerProprios) {
    return false;
  }

  const query = Cliente.query()
    .findById(id)
    .select('id', 'criado_por_id');

  if (!opcoes.incluirLixeira) {
    query.whereNull('excluido_em');
  }

  const cliente = await query;

  return Number(cliente?.criado_por_id) === Number(usuarioId);
}

async function criarCliente(dados, usuarioId) {
  return Cliente.query().insertAndFetch({
    ...montarPayload(dados),
    criado_por_id: usuarioId
  });
}

async function atualizarCliente(id, dados, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId);

  if (!permitido) {
    return null;
  }

  return Cliente.query().patchAndFetchById(id, {
    ...montarPayload(dados),
    updated_at: new Date()
  });
}

async function excluirCliente(id, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId);

  if (!permitido) {
    return 0;
  }

  const agora = new Date();

  return Cliente.knex()('clientes')
    .where('id', id)
    .whereNull('excluido_em')
    .update({
      excluido_em: formatarDateTimeSQL(agora),
      excluir_definitivo_em: formatarDateTimeSQL(adicionarUmMes(agora)),
      excluido_por_id: usuarioId,
      updated_at: formatarDateTimeSQL(agora)
    });
}

async function limparClientesVencidosDaLixeira() {
  return Cliente.knex()('clientes')
    .whereNotNull('excluido_em')
    .where('excluir_definitivo_em', '<=', formatarDateTimeSQL())
    .delete();
}

async function listarClientesLixeira(filtros = {}, usuarioId) {
  await limparClientesVencidosDaLixeira();

  const escopo = await buscarEscopoClientes(usuarioId);
  const query = Cliente.query()
    .withGraphFetched('[operadoraAtual, criador, excluidoPor]')
    .whereNotNull('excluido_em')
    .orderBy('excluido_em', 'desc')
    .orderBy('id', 'desc');

  aplicarEscopoClientes(query, usuarioId, escopo);

  if (filtros.busca) {
    const busca = `%${filtros.busca}%`;

    query.where((builder) => {
      builder
        .where('nome', 'like', busca)
        .orWhere('razao_social', 'like', busca)
        .orWhere('cnpj', 'like', busca)
        .orWhere('email', 'like', busca)
        .orWhere('responsavel_nome', 'like', busca);
    });
  }

  return (await query).map(formatarCliente);
}

async function restaurarCliente(id, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return null;
  }

  const atualizados = await Cliente.knex()('clientes')
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

  return buscarClientePorId(id, usuarioId);
}

async function excluirClienteDefinitivo(id, usuarioId) {
  const permitido = await usuarioPodeAcessarCliente(id, usuarioId, { incluirLixeira: true });

  if (!permitido) {
    return 0;
  }

  return Cliente.knex()('clientes')
    .where('id', id)
    .whereNotNull('excluido_em')
    .delete();
}

module.exports = {
  listarClientes,
  listarClientesLixeira,
  buscarClientePorId,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  restaurarCliente,
  excluirClienteDefinitivo,
  usuarioPodeAcessarCliente
};
