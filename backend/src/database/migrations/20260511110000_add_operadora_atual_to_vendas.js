exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.integer('operadora_atual_id').unsigned().nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('operadora_atual_id');
  });
};
