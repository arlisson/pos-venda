exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'responsavel_nome');
  if (existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.string('responsavel_nome', 255).nullable().after('operadora');
    table.index(['responsavel_nome'], 'idx_vendas_antigas_responsavel_nome');
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'responsavel_nome');
  if (!existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.dropIndex(['responsavel_nome'], 'idx_vendas_antigas_responsavel_nome');
    table.dropColumn('responsavel_nome');
  });
};