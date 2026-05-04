exports.up = function (knex) {
  return knex.schema.alterTable('vendas', function (table) {
    table
      .integer('plano_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('planos')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', function (table) {
    table.dropForeign(['plano_id']);
    table.dropColumn('plano_id');
  });
};
