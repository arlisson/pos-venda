const usuarioService = require('../services/usuario.service');

const knex = require('../database/connection');  // Certifique-se de importar o knex corretamente
const Usuario = require('../models/Usuario'); // Caso você esteja usando o modelo para usuários
const bcrypt = require('bcrypt');  // Importa o bcrypt

async function index(req, res) {
  try {
    const usuarios = await usuarioService.listarUsuarios();

    return res.json(usuarios);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar usuários.'
    });
  }
}

async function show(req, res) {
  try {
    const usuario = await usuarioService.buscarUsuarioPorId(req.params.id);

    if (!usuario) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    return res.json(usuario);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao buscar usuário.'
    });
  }
}

async function store(req, res) {
  try {
    const { nome, email, senha, role_id, permissoes } = req.body;

    // Verifica se a role existe
    const role = await knex('roles').where('id', role_id).first();
    if (!role) {
      return res.status(400).json({ message: 'Role não encontrada.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await knex('usuarios').insert({
      nome,
      email,
      senha: senhaHash,
      role_id,
      permissoes: JSON.stringify(permissoes)
    }).returning('*');

    return res.status(201).json(usuario[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
}

async function update(req, res) {
  try {
    const usuario = await usuarioService.atualizarUsuario(req.params.id, req.body);

    if (!usuario) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    return res.json(usuario);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao atualizar usuário.'
    });
  }
}

async function destroy(req, res) {
  try {
    const totalExcluido = await usuarioService.excluirUsuario(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({
        message: 'Usuário não encontrado.'
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao excluir usuário.'
    });
  }
}

module.exports = {
  index,
  show,
  store,
  update,
  destroy
};