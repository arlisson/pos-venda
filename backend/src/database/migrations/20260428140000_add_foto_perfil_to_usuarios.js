exports.up = function (knex) {
  return knex.schema.alterTable('usuarios', function (table) {
    table.longtext('foto_perfil').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('usuarios', function (table) {
    table.dropColumn('foto_perfil');
  });
};
