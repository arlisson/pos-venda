exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('venda_aprovacao_solicitacoes');
  if (!existeTabela) return;

  const existeColuna = await knex.schema.hasColumn('venda_aprovacao_solicitacoes', 'motivo_descricao');
  if (!existeColuna) {
    await knex.schema.alterTable('venda_aprovacao_solicitacoes', table => {
      table.text('motivo_descricao').nullable().after('motivos');
    });
  }
};

exports.down = async function (knex) {
  const existeTabela = await knex.schema.hasTable('venda_aprovacao_solicitacoes');
  const existeColuna = existeTabela && await knex.schema.hasColumn('venda_aprovacao_solicitacoes', 'motivo_descricao');

  if (existeColuna) {
    await knex.schema.alterTable('venda_aprovacao_solicitacoes', table => {
      table.dropColumn('motivo_descricao');
    });
  }
};