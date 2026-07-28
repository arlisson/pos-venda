exports.up = async function (knex) {
  const temAvaliacao = await knex.schema.hasColumn('lead_linhas', 'primeira_ligacao_avaliacao');
  if (temAvaliacao) return;

  await knex.schema.alterTable('lead_linhas', table => {
    table.string('primeira_ligacao_avaliacao', 20).nullable();
    table.integer('primeira_ligacao_avaliada_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL');
    table.datetime('primeira_ligacao_avaliada_em').nullable();
    table.index(['primeira_ligacao_avaliacao'], 'lead_linhas_primeira_ligacao_avaliacao_idx');
    table.index(['primeira_ligacao_avaliada_por_id'], 'lead_linhas_primeira_ligacao_avaliador_idx');
  });
};

exports.down = async function (knex) {
  const temAvaliacao = await knex.schema.hasColumn('lead_linhas', 'primeira_ligacao_avaliacao');
  if (!temAvaliacao) return;

  await knex.schema.alterTable('lead_linhas', table => {
    table.dropIndex(['primeira_ligacao_avaliada_por_id'], 'lead_linhas_primeira_ligacao_avaliador_idx');
    table.dropIndex(['primeira_ligacao_avaliacao'], 'lead_linhas_primeira_ligacao_avaliacao_idx');
    table.dropColumn('primeira_ligacao_avaliada_em');
    table.dropColumn('primeira_ligacao_avaliada_por_id');
    table.dropColumn('primeira_ligacao_avaliacao');
  });
};
