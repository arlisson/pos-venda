const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Usuario = require('../models/Usuario');

async function login(email, senha) {
  const usuario = await Usuario.query()
    .where('email', email)
    .withGraphFetched('role')
    .first();

  if (!usuario) {
    throw new Error('E-mail ou senha inválidos.');
  }

  if (!usuario.ativo) {
    throw new Error('Usuário inativo.');
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

  if (!senhaCorreta) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      role_id: usuario.role_id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );

  return {
    token,
    usuario: usuario.toJSON()
  };
}

async function buscarUsuarioLogado(usuarioId) {
  const usuario = await Usuario.query()
    .findById(usuarioId)
    .withGraphFetched('role');

  if (!usuario) {
    throw new Error('Usuário não encontrado.');
  }

  if (!usuario.ativo) {
    throw new Error('Usuário inativo.');
  }

  return usuario;
}

module.exports = {
  login,
  buscarUsuarioLogado
};