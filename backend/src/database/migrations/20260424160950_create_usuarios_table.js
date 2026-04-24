exports.up = function (knex) {
  return knex.schema.createTable('usuarios', function (table) {
    table.increments('id').primary();

    table.string('nome', 120).notNullable();
    table.string('email', 160).notNullable().unique();
    table.string('senha', 255).notNullable();

    table
      .integer('role_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('roles')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');

    table.boolean('ativo').notNullable().defaultTo(true);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('usuarios');
};