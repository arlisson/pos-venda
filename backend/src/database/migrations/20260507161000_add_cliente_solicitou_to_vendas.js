exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.text('cliente_solicitou_servicos').nullable().after('valores_unitarios_chips');
    table.integer('cliente_solicitou_bloqueio_qtd').unsigned().nullable().after('cliente_solicitou_servicos');
    table.integer('cliente_solicitou_cancelamento_qtd').unsigned().nullable().after('cliente_solicitou_bloqueio_qtd');
    table.text('cliente_solicitou_numeros').nullable().after('cliente_solicitou_cancelamento_qtd');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('cliente_solicitou_numeros');
    table.dropColumn('cliente_solicitou_cancelamento_qtd');
    table.dropColumn('cliente_solicitou_bloqueio_qtd');
    table.dropColumn('cliente_solicitou_servicos');
  });
};
