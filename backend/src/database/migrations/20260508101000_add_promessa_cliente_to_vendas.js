exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.text('promessa_cliente').nullable();
    table.string('promessa_cumprida', 20).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('promessa_cumprida');
    table.dropColumn('promessa_cliente');
  });
};
