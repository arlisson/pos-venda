exports.up = function (knex) {
  return knex.schema.alterTable('usuarios', function (table) {
    table.json('permissoes_negadas').notNullable().defaultTo('[]');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('usuarios', function (table) {
    table.dropColumn('permissoes_negadas');
  });
};
