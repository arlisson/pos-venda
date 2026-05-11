exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.string('cliente_solicitou_resolvido', 10).nullable().after('cliente_solicitou_numeros');
    table.date('cliente_solicitou_resolvido_em').nullable().after('cliente_solicitou_resolvido');
    table.string('cliente_solicitou_protocolo_atendimento', 120).nullable().after('cliente_solicitou_resolvido_em');
    table.text('cliente_solicitou_observacao').nullable().after('cliente_solicitou_protocolo_atendimento');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('cliente_solicitou_observacao');
    table.dropColumn('cliente_solicitou_protocolo_atendimento');
    table.dropColumn('cliente_solicitou_resolvido_em');
    table.dropColumn('cliente_solicitou_resolvido');
  });
};
