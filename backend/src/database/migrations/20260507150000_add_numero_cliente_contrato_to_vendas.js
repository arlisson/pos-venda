exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.string('numero_cliente_contrato', 120).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('numero_cliente_contrato');
  });
};
