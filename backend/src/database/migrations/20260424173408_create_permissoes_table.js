exports.up = function (knex) {
  return knex.schema.createTable('permissoes', function (table) {
    table.increments('id').primary();

    table.string('chave', 80).notNullable().unique();
    table.string('nome', 120).notNullable();
    table.string('descricao', 255).nullable();

    table.boolean('ativo').notNullable().defaultTo(true);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('permissoes');
};