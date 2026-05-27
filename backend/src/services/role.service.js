/**
 * Servico de consulta de perfis de acesso.
 */
const Role = require('../models/Role');

/**
 * Lista roles conforme os filtros e parametros informados.
 */
async function listarRoles() {
  return Role.query().orderBy('nome', 'asc');
}

/**
 * Busca role por id conforme os parametros informados.
 */
async function buscarRolePorId(id) {
  return Role.query().findById(id);
}

module.exports = {
  listarRoles,
  buscarRolePorId
};
