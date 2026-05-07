const PERMISSAO = {
  chave: 'notificacoes_vendas_paradas',
  nome: 'Notificações: vendas paradas no funil',
  descricao: 'Permite receber notificações de vendas paradas por 5+ dias úteis no mesmo estágio do funil.'
};

exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('venda_notificacao_parada');

  if (!existeTabela) {
    await knex.schema.createTable('venda_notificacao_parada', function (table) {
      table.increments('id').primary();
      table.integer('venda_id').unsigned().notNullable()
        .references('id')
        .inTable('vendas')
        .onDelete('CASCADE');
      table.string('etapa_codigo', 40).notNullable();
      table.timestamp('data_entrada_etapa').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['venda_id', 'etapa_codigo']);
      table.index('data_entrada_etapa');
      table.index('venda_id');
    });
  }

  const permissaoExistente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (permissaoExistente) {
    await knex('permissoes')
      .where('id', permissaoExistente.id)
      .update({
        nome: PERMISSAO.nome,
        descricao: PERMISSAO.descricao,
        ativo: true
      });
  } else {
    await knex('permissoes').insert({
      ...PERMISSAO,
      ativo: true
    });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('venda_notificacao_parada');
};
