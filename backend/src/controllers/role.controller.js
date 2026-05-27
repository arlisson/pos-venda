const roleService = require('../services/role.service');

/**
 * Lista todos os perfis de acesso cadastrados.
 *
 * @param {import('express').Request} req - Requisicao HTTP.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Lista de roles.
 */
async function index(req, res) {
  try {
    const roles = await roleService.listarRoles();

    return res.json(roles);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar roles.'
    });
  }
}

/**
 * Busca um perfil de acesso pelo identificador.
 *
 * @param {import('express').Request} req - Requisicao com id em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Role encontrada ou erro 404.
 */
async function show(req, res) {
  try {
    const role = await roleService.buscarRolePorId(req.params.id);

    if (!role) {
      return res.status(404).json({
        message: 'Role não encontrada.'
      });
    }

    return res.json(role);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao buscar role.'
    });
  }
}

module.exports = {
  index,
  show
};
