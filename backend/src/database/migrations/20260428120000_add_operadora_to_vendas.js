exports.up = function (knex) {
  return knex.schema.alterTable('vendas', function (table) {
    table
      .integer('operadora_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('operadoras')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('operadora_id');
  });
};
