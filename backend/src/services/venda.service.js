const Venda = require('../models/Venda');
const Usuario = require('../models/Usuario');
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
  'vendedora_id',
  'status_funil',
  'status_anterior_retorno',
  'motivo_retorno',
  'nota_correcao_retorno',
  'retornou_em',
  'corrigido_em'
];

const FUNIL_STATUS = ['aprovacao', 'ativacao', 'envio', 'entrega', 'confirmacao', 'concluido', 'retorno'];

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

function normalizarItensChips(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    return valor
      .map(item => ({
        quantidade: Number(item.quantidade || 0),
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
  }

  if (payload.data_venda !== undefined) {
    payload.data_venda = normalizarData(payload.data_venda);
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

function aplicarEscopoVendas(query, usuarioId, escopo) {
  if (escopo.podeVerTodas) {
    return query;
  }

  if (!escopo.podeVerProprias) {
    query.whereRaw('1 = 0');
    return query;
  }

  query.where((builder) => {
    builder
      .where('criado_por_id', usuarioId)
      .orWhere('vendedora_id', usuarioId);
  });

  return query;
}

function dataReferenciaVendaSQL(alias = 'v') {
  return `COALESCE(NULLIF(NULLIF(${alias}.data_venda, '0000-00-00'), '1899-11-30'), NULLIF(DATE(${alias}.criado_em), '0000-00-00'), DATE(${alias}.created_at))`;
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
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, criador]')
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

  if (filtros.status_funil) {
    query.where('status_funil', filtros.status_funil);
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
  aplicarEscopoVendas(queryHoje, usuarioId, escopo);

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
  aplicarEscopoVendas(queryPipeline, usuarioId, escopo);

  const pipeline = await queryPipeline
    .whereNull('v.excluido_em')
    .whereNotIn('v.status_funil', ['concluido', 'retorno'])
    .select(
      Venda.raw('COUNT(*) as pipeline_count'),
      Venda.raw('COALESCE(SUM(COALESCE(v.valor_total, 0)), 0) as pipeline')
    )
    .first();

  const queryRetornos = Venda.query().alias('v');
  aplicarEscopoVendas(queryRetornos, usuarioId, escopo);

  const retornos = await queryRetornos
    .whereNull('v.excluido_em')
    .where('v.status_funil', 'retorno')
    .select(
      Venda.raw('COUNT(*) as retornos'),
      Venda.raw('COALESCE(SUM(COALESCE(v.valor_total, 0)), 0) as perda')
    )
    .first();

  return {
    vendasDia: Number(vendasHoje?.vendas_dia || 0),
    valorDia: Number(vendasHoje?.valor_dia || 0),
    concluidasDia: Number(vendasHoje?.concluidas_dia || 0),
    pipeline: Number(pipeline?.pipeline || 0),
    pipelineCount: Number(pipeline?.pipeline_count || 0),
    retornos: Number(retornos?.retornos || 0),
    perda: Number(retornos?.perda || 0)
  };
}

async function buscarVendaPorId(id, usuarioId) {
  const escopo = usuarioId ? await buscarEscopoVendas(usuarioId) : { podeVerTodas: true };
  const query = Venda.query()
    .findById(id)
    .whereNull('excluido_em')
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, criador]');

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
      throw new Error('Cliente nao encontrado.');
    }

    payload = aplicarDadosClienteNaVenda(payload, cliente);
  }

  return Venda.query().insertAndFetch({
    ...payload,
    criado_por_id: usuarioId,
    criado_em: agora,
    ultima_atividade_em: agora
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
      throw new Error('Cliente nao encontrado.');
    }

    payload = aplicarDadosClienteNaVenda(payload, cliente);
  }

  return Venda.query().patchAndFetchById(id, {
    ...payload,
    ultima_atividade_em: agora,
    updated_at: agora
  });
}

function validarStatusFunil(status) {
  return FUNIL_STATUS.includes(status);
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

  if (!validarStatusFunil(status)) {
    return { status: 'invalid', message: 'Status do funil invalido.' };
  }

  if (status === 'retorno') {
    const motivo = String(dados.motivo_retorno || '').trim();

    if (!motivo) {
      return { status: 'invalid', message: 'Informe o motivo do retorno.' };
    }

    const statusAnterior = venda.status_funil && venda.status_funil !== 'retorno'
      ? venda.status_funil
      : (venda.status_anterior_retorno || 'aprovacao');

    const vendaAtualizada = await Venda.query().patchAndFetchById(id, {
      status_funil: 'retorno',
      status_anterior_retorno: statusAnterior,
      motivo_retorno: motivo,
      nota_correcao_retorno: null,
      retornou_em: agora,
      corrigido_em: null,
      ultima_atividade_em: agora,
      updated_at: agora
    });

    return { status: 'ok', venda: vendaAtualizada };
  }

  if (venda.status_funil === 'retorno') {
    const nota = String(dados.nota_correcao_retorno || '').trim();

    if (!nota) {
      return { status: 'invalid', message: 'Informe o que foi corrigido.' };
    }

    const destino = venda.status_anterior_retorno || 'aprovacao';

    const vendaAtualizada = await Venda.query().patchAndFetchById(id, {
      status_funil: destino,
      nota_correcao_retorno: nota,
      corrigido_em: agora,
      ultima_atividade_em: agora,
      updated_at: agora
    });

    return { status: 'ok', venda: vendaAtualizada };
  }

  const vendaAtualizada = await Venda.query().patchAndFetchById(id, {
    status_funil: status,
    ultima_atividade_em: agora,
    updated_at: agora
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
  buscarVendaPorId,
  criarVenda,
  atualizarVenda,
  atualizarStatusVenda,
  excluirVenda,
  restaurarVenda,
  excluirVendaDefinitivo,
  listarVendedoras
};
