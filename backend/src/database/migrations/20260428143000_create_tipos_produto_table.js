exports.up = async function (knex) {
  await knex.schema.createTable('tipos_produto', function (table) {
    table.increments('id').primary();
    table.string('nome', 80).notNullable().unique();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('tipos_produto').insert([
    { nome: 'Novo', ordem: 1 },
    { nome: 'Portabilidade', ordem: 2 },
    { nome: 'Internet', ordem: 3 }
  ]);

  return knex.schema.alterTable('vendas', function (table) {
    table
      .integer('tipo_produto_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('tipos_produto')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropForeign(['tipo_produto_id']);
    table.dropColumn('tipo_produto_id');
  });

  return knex.schema.dropTableIfExists('tipos_produto');
};
