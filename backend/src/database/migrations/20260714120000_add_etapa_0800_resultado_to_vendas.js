exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'etapa_0800_resultado');

  if (!existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.string('etapa_0800_resultado', 20).nullable().defaultTo(null);
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'etapa_0800_resultado');

  if (existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.dropColumn('etapa_0800_resultado');
    });
  }
};
