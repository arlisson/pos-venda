const TABELA = 'dashboard_integracao_vendas';

exports.up = async function up(knex) {
  if (await knex.schema.hasColumn(TABELA, 'pode_reenviar_manualmente')) return;

  await knex.schema.alterTable(TABELA, (table) => {
    // Registros anteriores a esta migration permanecem inelegiveis para reenvio.
    table.boolean('pode_reenviar_manualmente').notNullable().defaultTo(false).after('item_key');
  });
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn(TABELA, 'pode_reenviar_manualmente'))) return;

  await knex.schema.alterTable(TABELA, (table) => {
    table.dropColumn('pode_reenviar_manualmente');
  });
};
