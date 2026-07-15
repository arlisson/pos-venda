// Datas usam datetime (nao timestamp): com explicit_defaults_for_timestamp=0 as colunas
// timestamp gravam 0000-00-00 nesta base.
exports.up = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.boolean('chamada_nao_atendida').notNullable().defaultTo(false).after('cliente_recusou_por_id');
    table.text('chamada_nao_atendida_motivo').nullable().after('chamada_nao_atendida');
    table.datetime('chamada_nao_atendida_em').nullable().after('chamada_nao_atendida_motivo');
    table.integer('chamada_nao_atendida_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL')
      .after('chamada_nao_atendida_em');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.dropForeign('chamada_nao_atendida_por_id');
  });
  await knex.schema.table('lead_linhas', table => {
    table.dropColumn('chamada_nao_atendida_por_id');
    table.dropColumn('chamada_nao_atendida_em');
    table.dropColumn('chamada_nao_atendida_motivo');
    table.dropColumn('chamada_nao_atendida');
  });
};
