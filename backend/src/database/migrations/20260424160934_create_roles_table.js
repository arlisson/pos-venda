exports.up = function (knex) {
  return knex.schema.createTable('roles', function (table) {
    table.increments('id').primary();

    table.string('nome', 50).notNullable().unique();
    table.string('descricao', 255).nullable();

    table.json('permissoes').notNullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('roles');
};