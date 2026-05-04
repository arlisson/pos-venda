exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('entidade_notas', 'retorno_agendado_para');

  if (!hasColumn) {
    await knex.schema.alterTable('entidade_notas', function (table) {
      table.timestamp('retorno_agendado_para').nullable().after('conteudo');
      table.index(['usuario_id', 'retorno_agendado_para'], 'entidade_notas_usuario_retorno_idx');
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('entidade_notas', 'retorno_agendado_para');

  if (hasColumn) {
    await knex.schema.alterTable('entidade_notas', function (table) {
      table.dropIndex(['usuario_id', 'retorno_agendado_para'], 'entidade_notas_usuario_retorno_idx');
      table.dropColumn('retorno_agendado_para');
    });
  }
};
