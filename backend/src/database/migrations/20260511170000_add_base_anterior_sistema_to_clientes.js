exports.up = function (knex) {
  return knex.schema.alterTable('clientes', (table) => {
    table.boolean('base_anterior_sistema').notNullable().defaultTo(false).after('quantidade_chips');
    table.index(['base_anterior_sistema']);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('clientes', (table) => {
    table.dropIndex(['base_anterior_sistema']);
    table.dropColumn('base_anterior_sistema');
  });
};
