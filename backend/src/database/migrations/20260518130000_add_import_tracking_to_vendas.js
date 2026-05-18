exports.up = async function (knex) {
  const hasOrigem = await knex.schema.hasColumn('vendas', 'origem_importacao');
  const hasChave = await knex.schema.hasColumn('vendas', 'chave_importacao');
  const hasArquivo = await knex.schema.hasColumn('vendas', 'arquivo_importacao');
  const hasLinha = await knex.schema.hasColumn('vendas', 'linha_importacao');

  await knex.schema.alterTable('vendas', function (table) {
    if (!hasOrigem) {
      table.string('origem_importacao', 80).nullable().after('cliente_id');
    }

    if (!hasChave) {
      table.string('chave_importacao', 80).nullable().after('origem_importacao');
    }

    if (!hasArquivo) {
      table.string('arquivo_importacao', 255).nullable().after('chave_importacao');
    }

    if (!hasLinha) {
      table.integer('linha_importacao').unsigned().nullable().after('arquivo_importacao');
    }
  });

  const hasIndex = await knex.schema.hasColumn('vendas', 'chave_importacao');
  if (hasIndex) {
    await knex.schema.alterTable('vendas', function (table) {
      table.index(['origem_importacao', 'chave_importacao'], 'vendas_importacao_chave_idx');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropIndex(['origem_importacao', 'chave_importacao'], 'vendas_importacao_chave_idx');
    table.dropColumn('linha_importacao');
    table.dropColumn('arquivo_importacao');
    table.dropColumn('chave_importacao');
    table.dropColumn('origem_importacao');
  });
};
