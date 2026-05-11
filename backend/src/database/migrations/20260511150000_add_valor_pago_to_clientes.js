exports.up = function (knex) {
  return knex.schema.alterTable('clientes', (table) => {
    table.decimal('valor_pago', 10, 2).nullable().after('operadora_atual_id');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('clientes', (table) => {
    table.dropColumn('valor_pago');
  });
};
