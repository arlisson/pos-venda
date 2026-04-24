const Permissao = require('../models/Permissao'); // Importa o modelo Permissao

// Função para listar todas as permissões ativas
async function listarPermissoes() {
  return Permissao.query()
    .where('ativo', true)  // Filtra as permissões ativas
    .orderBy('nome', 'asc');  // Ordena por nome
}

// Função para buscar permissão por ID
async function buscarPermissaoPorId(id) {
  return Permissao.query().findById(id);
}

// Função para criar uma nova permissão
async function criarPermissao(dados) {
  return Permissao.query().insert({
    chave: dados.chave,
    nome: dados.nome,
    descricao: dados.descricao || null,
    ativo: dados.ativo ?? true  // Se 'ativo' não for fornecido, assume-se como 'true'
  });
}

module.exports = {
  listarPermissoes,
  buscarPermissaoPorId,
  criarPermissao
};