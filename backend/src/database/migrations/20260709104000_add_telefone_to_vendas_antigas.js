exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'telefone');
  if (existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.string('telefone', 80).nullable().after('responsavel_nome');
    table.index(['telefone'], 'idx_vendas_antigas_telefone');
  });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas_antigas', 'telefone');
  if (!existe) return;

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.dropIndex(['telefone'], 'idx_vendas_antigas_telefone');
    table.dropColumn('telefone');
  });
};