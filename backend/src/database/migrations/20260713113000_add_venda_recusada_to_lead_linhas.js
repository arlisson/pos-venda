exports.up = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.text('venda_recusada_motivo').nullable().after('venda_id');
    table.timestamp('venda_recusada_em').nullable().after('venda_recusada_motivo');
    table.integer('venda_recusada_por_id').unsigned().nullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL').after('venda_recusada_em');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.dropColumn('venda_recusada_por_id');
    table.dropColumn('venda_recusada_em');
    table.dropColumn('venda_recusada_motivo');
  });
};