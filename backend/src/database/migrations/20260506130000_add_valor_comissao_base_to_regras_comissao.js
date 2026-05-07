exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('regras_comissao');
  if (!existeTabela) return;

  const existeColuna = await knex.schema.hasColumn('regras_comissao', 'valor_comissao_base');
  let colunaCriada = false;

  if (!existeColuna) {
    await knex.schema.alterTable('regras_comissao', function (table) {
      table.decimal('valor_comissao_base', 10, 2).notNullable().defaultTo(0).after('valor_comissao');
    });
    colunaCriada = true;
  }

  if (colunaCriada) {
    await knex('regras_comissao').update({
      valor_comissao_base: knex.raw('valor_comissao')
    });
  }
};

exports.down = async function (knex) {
  const existeTabela = await knex.schema.hasTable('regras_comissao');
  if (!existeTabela) return;

  const existeColuna = await knex.schema.hasColumn('regras_comissao', 'valor_comissao_base');
  if (existeColuna) {
    await knex.schema.alterTable('regras_comissao', function (table) {
      table.dropColumn('valor_comissao_base');
    });
  }
};
