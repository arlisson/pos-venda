const LinkExterno = require('../models/LinkExterno');
const Operadora = require('../models/Operadora');

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

async function listarOperadorasAtivas() {
  return Operadora.query()
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
  listarLinksExternos,
  listarLinksExternosAtivos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
