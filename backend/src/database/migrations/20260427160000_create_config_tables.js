exports.up = async function (knex) {
  await knex.schema.createTable('operadoras', function (table) {
    table.increments('id').primary();
    table.string('nome', 80).notNullable().unique();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  return knex.schema.createTable('links_externos', function (table) {
    table.increments('id').primary();
    table.string('chave', 80).notNullable().unique();
    table.string('nome', 120).notNullable();
    table.text('url').notNullable();
    table.string('dot', 40).nullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('links_externos');
  return knex.schema.dropTableIfExists('operadoras');
};
