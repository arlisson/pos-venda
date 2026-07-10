exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'operadora');
  if (existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.string('operadora', 255).nullable().after('data_venda');
    table.index(['operadora'], 'idx_vendas_antigas_operadora');
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'operadora');
  if (!existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.dropIndex(['operadora'], 'idx_vendas_antigas_operadora');
    table.dropColumn('operadora');
  });
};