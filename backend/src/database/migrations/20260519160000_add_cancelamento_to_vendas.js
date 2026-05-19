exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.timestamp('cancelada_em').nullable();
    table.text('motivo_cancelamento').nullable();
    table
      .integer('cancelada_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table.index(['cancelada_em']);
    table.index(['cancelada_por_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropIndex(['cancelada_em']);
    table.dropIndex(['cancelada_por_id']);
    table.dropForeign(['cancelada_por_id']);
    table.dropColumn('cancelada_por_id');
    table.dropColumn('motivo_cancelamento');
    table.dropColumn('cancelada_em');
  });
};
