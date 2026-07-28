exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('lead_linhas', 'retorno_agendado_observacao');
  if (!hasColumn) {
    await knex.schema.alterTable('lead_linhas', table => {
      table.text('retorno_agendado_observacao').nullable().after('retorno_agendado_em');
    });
  }
};

exports.down = async function down(knex) {
  const migrationCompativel = await knex('knex_migrations')
    .where({
      name: '20260728160000_add_retorno_observacao_to_lead_linhas.js'
    })
    .first('id');

  if (migrationCompativel) {
    return;
  }

  const hasColumn = await knex.schema.hasColumn('lead_linhas', 'retorno_agendado_observacao');
  if (hasColumn) {
    await knex.schema.alterTable('lead_linhas', table => {
      table.dropColumn('retorno_agendado_observacao');
    });
  }
};
