exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.string('status_funil', 40).notNullable().defaultTo('aprovacao');
    table.string('status_anterior_retorno', 40).nullable();
    table.string('motivo_retorno', 255).nullable();
    table.text('nota_correcao_retorno').nullable();
    table.timestamp('retornou_em').nullable();
    table.timestamp('corrigido_em').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('corrigido_em');
    table.dropColumn('retornou_em');
    table.dropColumn('nota_correcao_retorno');
    table.dropColumn('motivo_retorno');
    table.dropColumn('status_anterior_retorno');
    table.dropColumn('status_funil');
  });
};
