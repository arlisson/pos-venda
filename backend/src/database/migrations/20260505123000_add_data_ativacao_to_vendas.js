exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'data_ativacao');

  if (!existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.date('data_ativacao').nullable().after('data_venda');
      table.index(['status_funil', 'data_ativacao']);
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'data_ativacao');

  if (existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.dropIndex(['status_funil', 'data_ativacao']);
      table.dropColumn('data_ativacao');
    });
  }
};
