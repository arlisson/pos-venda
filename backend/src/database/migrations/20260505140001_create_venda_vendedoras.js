exports.up = function (knex) {
  return knex.schema.createTable('venda_vendedoras', (table) => {
    table.increments('id');
    table.integer('venda_id').unsigned().notNullable()
      .references('id').inTable('vendas').onDelete('CASCADE');
    table.integer('usuario_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    table.integer('ordem').unsigned().defaultTo(1);
    table.timestamps(true, true);
    table.unique(['venda_id', 'usuario_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('venda_vendedoras');
};
