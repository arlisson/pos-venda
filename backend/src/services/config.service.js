const LinkExterno = require('../models/LinkExterno');
const Operadora = require('../models/Operadora');

async function listarOperadoras() {
  return Operadora.query()
    .select('id', 'nome')
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

async function listarLinksExternos() {
  return LinkExterno.query()
    .select('id', 'chave', 'nome', 'url', 'dot')
    .where('ativo', true)
    .orderBy('ordem', 'asc')
    .orderBy('nome', 'asc');
}

module.exports = {
  listarOperadoras,
  listarLinksExternos
};
