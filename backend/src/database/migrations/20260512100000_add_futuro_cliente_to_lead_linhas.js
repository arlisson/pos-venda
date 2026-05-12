exports.up = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.boolean('futuro_cliente').notNullable().defaultTo(false);
    table.text('futuro_cliente_notas').nullable();
    table.datetime('futuro_cliente_retorno').nullable();
    table.datetime('futuro_cliente_marcado_em').nullable();
    table.integer('futuro_cliente_marcado_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.dropColumn('futuro_cliente');
    table.dropColumn('futuro_cliente_notas');
    table.dropColumn('futuro_cliente_retorno');
    table.dropColumn('futuro_cliente_marcado_em');
    table.dropColumn('futuro_cliente_marcado_por_id');
  });
};
