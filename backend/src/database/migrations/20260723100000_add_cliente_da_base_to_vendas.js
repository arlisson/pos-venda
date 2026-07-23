exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.boolean('cliente_da_base').nullable().after('valores_unitarios_chips');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('cliente_da_base');
  });
};