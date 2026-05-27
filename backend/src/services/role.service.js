/**
 * Servico de consulta de perfis de acesso.
 */
const Role = require('../models/Role');

/**
 * Executa a rotina listar roles.
 */
async function listarRoles() {
  return Role.query().orderBy('nome', 'asc');
}

/**
 * Executa a rotina buscar role por id.
 */
async function buscarRolePorId(id) {
  return Role.query().findById(id);
}

module.exports = {
  listarRoles,
  buscarRolePorId
};
