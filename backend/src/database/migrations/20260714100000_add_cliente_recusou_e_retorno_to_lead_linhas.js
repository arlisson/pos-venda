// Datas usam datetime (nao timestamp): com explicit_defaults_for_timestamp=0 as colunas
// timestamp gravam 0000-00-00 nesta base. O mesmo vale para venda_recusada_em, corrigida aqui.
exports.up = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.boolean('cliente_recusou').notNullable().defaultTo(false).after('venda_recusada_por_id');
    table.text('cliente_recusou_motivo').nullable().after('cliente_recusou');
    table.datetime('cliente_recusou_em').nullable().after('cliente_recusou_motivo');
    table.integer('cliente_recusou_por_id').unsigned().nullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL').after('cliente_recusou_em');
    table.datetime('retorno_agendado_em').nullable().after('cliente_recusou_por_id');
    table.integer('retorno_agendado_por_id').unsigned().nullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL').after('retorno_agendado_em');
  });

  await knex.raw('ALTER TABLE lead_linhas MODIFY COLUMN venda_recusada_em DATETIME NULL');
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE lead_linhas MODIFY COLUMN venda_recusada_em TIMESTAMP NULL');

  await knex.schema.table('lead_linhas', table => {
    table.dropForeign('retorno_agendado_por_id');
    table.dropForeign('cliente_recusou_por_id');
  });
  await knex.schema.table('lead_linhas', table => {
    table.dropColumn('retorno_agendado_por_id');
    table.dropColumn('retorno_agendado_em');
    table.dropColumn('cliente_recusou_por_id');
    table.dropColumn('cliente_recusou_em');
    table.dropColumn('cliente_recusou_motivo');
    table.dropColumn('cliente_recusou');
  });
};
