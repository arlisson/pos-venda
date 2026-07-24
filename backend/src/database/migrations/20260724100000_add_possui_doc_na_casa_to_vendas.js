exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.boolean('possui_doc_na_casa').nullable().after('cliente_da_base');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('possui_doc_na_casa');
  });
};
