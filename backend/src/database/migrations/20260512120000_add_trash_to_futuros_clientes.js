exports.up = async function (knex) {
  const hasExcluidoEm = await knex.schema.hasColumn('lead_linhas', 'futuro_cliente_excluido_em');
  if (hasExcluidoEm) return;

  await knex.schema.table('lead_linhas', table => {
    table.datetime('futuro_cliente_excluido_em').nullable();
    table.datetime('futuro_cliente_excluir_definitivo_em').nullable();
    table.integer('futuro_cliente_excluido_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onDelete('SET NULL');
    table.index(['futuro_cliente_excluido_em'], 'lead_linhas_futuro_excluido_idx');
    table.index(['futuro_cliente_excluir_definitivo_em'], 'lead_linhas_futuro_excluir_def_idx');
    table.index(['futuro_cliente_excluido_por_id'], 'lead_linhas_futuro_excluido_por_idx');
  });
};

exports.down = async function (knex) {
  const hasExcluidoEm = await knex.schema.hasColumn('lead_linhas', 'futuro_cliente_excluido_em');
  if (!hasExcluidoEm) return;

  await knex.schema.table('lead_linhas', table => {
    table.dropIndex(['futuro_cliente_excluido_em'], 'lead_linhas_futuro_excluido_idx');
    table.dropIndex(['futuro_cliente_excluir_definitivo_em'], 'lead_linhas_futuro_excluir_def_idx');
    table.dropIndex(['futuro_cliente_excluido_por_id'], 'lead_linhas_futuro_excluido_por_idx');
    table.dropForeign(['futuro_cliente_excluido_por_id']);
    table.dropColumn('futuro_cliente_excluido_por_id');
    table.dropColumn('futuro_cliente_excluir_definitivo_em');
    table.dropColumn('futuro_cliente_excluido_em');
  });
};
