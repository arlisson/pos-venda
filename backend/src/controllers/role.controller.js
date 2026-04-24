const roleService = require('../services/role.service');

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