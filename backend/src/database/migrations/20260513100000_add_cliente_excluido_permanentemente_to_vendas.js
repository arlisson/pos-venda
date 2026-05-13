exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('vendas', 'cliente_excluido_permanentemente_em');
  if (hasColumn) return;

  await knex.schema.alterTable('vendas', function (table) {
    table.datetime('cliente_excluido_permanentemente_em').nullable();
    table.string('cliente_excluido_permanentemente_nome', 240).nullable();
    table.string('cliente_excluido_permanentemente_cnpj', 20).nullable();
    table.index(['cliente_excluido_permanentemente_em'], 'vendas_cliente_excluido_perm_idx');
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('vendas', 'cliente_excluido_permanentemente_em');
  if (!hasColumn) return;

  await knex.schema.alterTable('vendas', function (table) {
    table.dropIndex(['cliente_excluido_permanentemente_em'], 'vendas_cliente_excluido_perm_idx');
    table.dropColumn('cliente_excluido_permanentemente_cnpj');
    table.dropColumn('cliente_excluido_permanentemente_nome');
    table.dropColumn('cliente_excluido_permanentemente_em');
  });
};
