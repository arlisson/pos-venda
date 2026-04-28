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
  if (!valor) return valor;

  const texto = String(valor).trim();
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (!match) return texto;

  const [, dia, mes, ano] = match;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;

  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
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

async function usuarioPodeAcessarVenda(id, usuarioId) {
  const escopo = await buscarEscopoVendas(usuarioId);

  if (escopo.podeVerTodas) {
    return true;
  }

  if (!escopo.podeVerProprias) {
    return false;
  }

  const venda = await Venda.query()
    .findById(id)
    .select('id', 'criado_por_id', 'vendedora_id');

  return Number(venda?.criado_por_id) === Number(usuarioId)
    || Number(venda?.vendedora_id) === Number(usuarioId);
}

async function listarVendas(filtros = {}, usuarioId) {
  const escopo = await buscarEscopoVendas(usuarioId);
  const query = Venda.query()
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, criador]')
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

async function buscarVendaPorId(id, usuarioId) {
  const escopo = usuarioId ? await buscarEscopoVendas(usuarioId) : { podeVerTodas: true };
  const query = Venda.query()
    .findById(id)
    .withGraphFetched('[cliente, vendedora, operadora, tipoVenda, servico, criador]');

  if (usuarioId) {
    aplicarEscopoVendas(query, usuarioId, escopo);
  }

  return query;
}

async function criarVenda(dados, usuarioId) {
  const agora = new Date();
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

  const agora = new Date();
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

  if (!venda) {
    return { status: 'not_found' };
  }

  const agora = new Date();
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

  return Venda.query().deleteById(id);
}

async function listarVendedoras() {
  return Usuario.query()
    .select('id', 'nome', 'email', 'ativo')
    .where('ativo', true)
    .orderBy('nome', 'asc');
}

module.exports = {
  listarVendas,
  buscarVendaPorId,
  criarVenda,
  atualizarVenda,
  atualizarStatusVenda,
  excluirVenda,
  listarVendedoras
};
