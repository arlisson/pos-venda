const usuarioService = require('../services/usuario.service');

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
    const usuario = await usuarioService.criarUsuario(req.body);

    return res.status(201).json(usuario);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao criar usuário.'
    });
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