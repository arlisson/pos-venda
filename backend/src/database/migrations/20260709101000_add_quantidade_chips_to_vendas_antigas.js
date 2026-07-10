exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'quantidade_chips');
  if (existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.integer('quantidade_chips').unsigned().nullable().after('data_venda');
    table.index(['quantidade_chips'], 'idx_vendas_antigas_quantidade_chips');
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'quantidade_chips');
  if (!existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.dropIndex(['quantidade_chips'], 'idx_vendas_antigas_quantidade_chips');
    table.dropColumn('quantidade_chips');
  });
};