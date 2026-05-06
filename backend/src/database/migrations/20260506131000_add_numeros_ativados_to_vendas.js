exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'numeros_ativados');

  if (!existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.text('numeros_ativados').nullable().after('numeros_portados');
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('vendas', 'numeros_ativados');

  if (existe) {
    await knex.schema.alterTable('vendas', function (table) {
      table.dropColumn('numeros_ativados');
    });
  }
};
