exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'prioridade_funil');

  if (!existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.string('prioridade_funil', 20).notNullable().defaultTo('media');
      table.index(['prioridade_funil']);
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'prioridade_funil');

  if (existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.dropIndex(['prioridade_funil']);
      table.dropColumn('prioridade_funil');
    });
  }
};
