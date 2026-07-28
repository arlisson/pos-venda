exports.up = function (knex) {
  return knex.schema.createTable('dashboard_integracao_vendas', function (table) {
    table.increments('id').primary();
    table.integer('venda_id').unsigned().notNullable().unique()
      .references('id').inTable('vendas').onUpdate('CASCADE').onDelete('CASCADE');
    table.string('status', 20).notNullable().defaultTo('pendente');
    table.integer('tentativas').unsigned().notNullable().defaultTo(0);
    table.integer('dashboard_sale_id').unsigned().nullable();
    table.text('ultimo_erro').nullable();
    table.timestamp('ultima_tentativa_em').nullable();
    table.timestamp('enviada_em').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('dashboard_integracao_vendas');
};
