const Role = require('../models/Role');

async function listarRoles() {
  return Role.query().orderBy('nome', 'asc');
}

async function buscarRolePorId(id) {
  return Role.query().findById(id);
}

module.exports = {
  listarRoles,
  buscarRolePorId
};