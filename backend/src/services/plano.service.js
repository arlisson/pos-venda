const Plano = require('../models/Plano');

const CATEGORIAS = ['movel', 'fixo', 'internet'];
const TIPOS_SERVICO = ['novo', 'portabilidade'];

function normalizarTaxa(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  const numero = Number(String(valor).replace(',', '.'));
  if (Number.isNaN(numero)) return 0;
  return Math.max(0, Math.min(100, Number(numero.toFixed(2))));
}

function montarPayload(dados) {
  const payload = {};

  if (dados.nome !== undefined) payload.nome = String(dados.nome).trim();
  if (dados.operadora_id !== undefined) payload.operadora_id = Number(dados.operadora_id);
  if (dados.categoria !== undefined) {
    const cat = String(dados.categoria).trim().toLowerCase();
    if (!CATEGORIAS.includes(cat)) {
      throw new Error('Categoria invalida.');
    }
    payload.categoria = cat;
  }
  if (dados.tipo_servico !== undefined) {
    const tipo = String(dados.tipo_servico).trim().toLowerCase();
    if (!TIPOS_SERVICO.includes(tipo)) {
      throw new Error('Tipo de servico invalido.');
    }
    payload.tipo_servico = tipo;
  }
  if (dados.taxa_comissao !== undefined) payload.taxa_comissao = normalizarTaxa(dados.taxa_comissao);
  if (dados.ativo !== undefined) payload.ativo = Boolean(dados.ativo);
  if (dados.ordem !== undefined) payload.ordem = Number(dados.ordem) || 0;

  return payload;
}

async function listar(filtros = {}) {
  const query = Plano.query()
    .withGraphFetched('operadora')
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');

  if (filtros.operadora_id) {
    query.where('operadora_id', Number(filtros.operadora_id));
  }

  if (filtros.categoria) {
    query.where('categoria', String(filtros.categoria).toLowerCase());
  }

  if (filtros.tipo_servico) {
    query.where('tipo_servico', String(filtros.tipo_servico).toLowerCase());
  }

  if (filtros.ativo !== undefined && filtros.ativo !== '') {
    query.where('ativo', filtros.ativo === 'true' || filtros.ativo === true);
  }

  return query;
}

async function criar(dados) {
  const payload = montarPayload(dados);

  if (!payload.nome) {
    throw new Error('Informe o nome do plano.');
  }

  if (!payload.operadora_id) {
    throw new Error('Selecione a operadora.');
  }

  if (!payload.categoria) {
    throw new Error('Selecione a categoria.');
  }

  if (!payload.tipo_servico) {
    throw new Error('Selecione o tipo de servico.');
  }

  return Plano.query().insertAndFetch({
    ativo: true,
    ordem: 0,
    taxa_comissao: 0,
    ...payload
  });
}

async function atualizar(id, dados) {
  const payload = montarPayload(dados);

  if (Object.keys(payload).length === 0) {
    return Plano.query().findById(id).withGraphFetched('operadora');
  }

  return Plano.query().patchAndFetchById(id, payload).withGraphFetched('operadora');
}

async function excluir(id) {
  return Plano.query().deleteById(id);
}

module.exports = {
  listar,
  criar,
  atualizar,
  excluir
};
