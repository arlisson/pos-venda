const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');


async function listarUsuarios() {
  return Usuario.query()
    .withGraphFetched('role')
    .orderBy('nome', 'asc');
}

async function buscarUsuarioPorId(id) {
  return Usuario.query()
    .findById(id)
    .withGraphFetched('role');
}

async function criarUsuario(dados) {
  const senhaHash = await bcrypt.hash(dados.senha, 10);

  return Usuario.query().insert({
    nome: dados.nome,
    email: dados.email,
    senha: senhaHash,
    role_id: dados.role_id,
    permissoes: JSON.stringify(dados.permissoes || []),
    ativo: dados.ativo ?? true
  });
}

async function atualizarUsuario(id, dados) {
  const dadosAtualizacao = {};

  if (dados.permissoes !== undefined) {
    dadosAtualizacao.permissoes = JSON.stringify(dados.permissoes || []);
  }

  if (dados.nome !== undefined) {
    dadosAtualizacao.nome = dados.nome;
  }

  if (dados.email !== undefined) {
    dadosAtualizacao.email = dados.email;
  }

  if (dados.role_id !== undefined) {
    dadosAtualizacao.role_id = dados.role_id;
  }

  if (dados.ativo !== undefined) {
    dadosAtualizacao.ativo = dados.ativo;
  }

  if (dados.senha !== undefined && dados.senha !== '') {
    dadosAtualizacao.senha = await bcrypt.hash(dados.senha, 10);
  }

  return Usuario.query().patchAndFetchById(id, dadosAtualizacao);
}

async function excluirUsuario(id) {
  return Usuario.query().deleteById(id);
}

module.exports = {
  listarUsuarios,
  buscarUsuarioPorId,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario
};