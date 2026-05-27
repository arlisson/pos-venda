const roleService = require('../services/role.service');

/**
 * Lista todos os perfis de acesso cadastrados.
 *
 * @param {Object} req - Requisicao HTTP.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Lista de roles.
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
 * @param {Object} req - Requisicao com id em req.params.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Role encontrada ou erro 404.
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
