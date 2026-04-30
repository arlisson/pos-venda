const LinkExterno = require('../models/LinkExterno');
const Operadora = require('../models/Operadora');
const TipoProduto = require('../models/TipoProduto');
const TipoVenda = require('../models/TipoVenda');
const Servico = require('../models/Servico');
const FunilEtapa = require('../models/FunilEtapa');

function orderConfig(query) {
  return query.orderBy('ordem', 'asc').orderBy('nome', 'asc');
}

async function listarOperadoras() {
  return Operadora.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarLinksExternos() {
  return LinkExterno.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarTiposProduto() {
  return orderConfig(TipoProduto.query());
}

async function listarTiposVenda() {
  return orderConfig(TipoVenda.query());
}

async function listarServicos() {
  return orderConfig(Servico.query());
}

async function listarFunilEtapas() {
  return FunilEtapa.query()
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarOperadorasAtivas() {
  return Operadora.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarTiposProdutoAtivos() {
  return orderConfig(TipoProduto.query().where('ativo', true));
}

async function listarTiposVendaAtivos() {
  return orderConfig(TipoVenda.query().where('ativo', true));
}

async function listarServicosAtivos() {
  return orderConfig(Servico.query().where('ativo', true));
}

async function listarFunilEtapasAtivas() {
  return FunilEtapa.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarLinksExternosAtivos() {
  return LinkExterno.query()
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function criarOperadora(dados) {
  return Operadora.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarOperadora(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return Operadora.query().patchAndFetchById(id, atualizacao);
}

async function excluirOperadora(id) {
  return Operadora.query().deleteById(id);
}

async function criarTipoProduto(dados) {
  return TipoProduto.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarTipoProduto(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return TipoProduto.query().patchAndFetchById(id, atualizacao);
}

async function excluirTipoProduto(id) {
  return TipoProduto.query().deleteById(id);
}

async function criarTipoVenda(dados) {
  return TipoVenda.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarTipoVenda(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return TipoVenda.query().patchAndFetchById(id, atualizacao);
}

async function excluirTipoVenda(id) {
  return TipoVenda.query().deleteById(id);
}

async function criarServico(dados) {
  return Servico.query().insert({
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarServico(id, dados) {
  const atualizacao = {};

  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return Servico.query().patchAndFetchById(id, atualizacao);
}

async function excluirServico(id) {
  return Servico.query().deleteById(id);
}

function normalizarCodigoEtapa(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

async function criarFunilEtapa(dados) {
  const codigo = normalizarCodigoEtapa(dados.codigo || dados.nome);

  if (!codigo) {
    throw new Error('Informe um nome valido para a etapa.');
  }

  return FunilEtapa.query().insert({
    codigo,
    nome: dados.nome,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarFunilEtapa(id, dados) {
  const atualizacao = {};

  if (dados.codigo !== undefined) atualizacao.codigo = normalizarCodigoEtapa(dados.codigo);
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return FunilEtapa.query().patchAndFetchById(id, atualizacao);
}

async function excluirFunilEtapa(id) {
  return FunilEtapa.query().patchAndFetchById(id, { ativo: false });
}

async function criarLinkExterno(dados) {
  return LinkExterno.query().insert({
    chave: dados.chave,
    nome: dados.nome,
    url: dados.url,
    dot: dados.dot || null,
    ativo: dados.ativo ?? true,
    ordem: dados.ordem ?? 0
  });
}

async function atualizarLinkExterno(id, dados) {
  const atualizacao = {};

  if (dados.chave !== undefined) atualizacao.chave = dados.chave;
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.url !== undefined) atualizacao.url = dados.url;
  if (dados.dot !== undefined) atualizacao.dot = dados.dot || null;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (dados.ordem !== undefined) atualizacao.ordem = dados.ordem;

  return LinkExterno.query().patchAndFetchById(id, atualizacao);
}

async function excluirLinkExterno(id) {
  return LinkExterno.query().deleteById(id);
}

module.exports = {
  listarOperadoras,
  listarOperadorasAtivas,
  criarOperadora,
  atualizarOperadora,
  excluirOperadora,
  listarTiposProduto,
  listarTiposProdutoAtivos,
  criarTipoProduto,
  atualizarTipoProduto,
  excluirTipoProduto,
  listarTiposVenda,
  listarTiposVendaAtivos,
  criarTipoVenda,
  atualizarTipoVenda,
  excluirTipoVenda,
  listarServicos,
  listarServicosAtivos,
  criarServico,
  atualizarServico,
  excluirServico,
  listarFunilEtapas,
  listarFunilEtapasAtivas,
  criarFunilEtapa,
  atualizarFunilEtapa,
  excluirFunilEtapa,
  listarLinksExternos,
  listarLinksExternosAtivos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
