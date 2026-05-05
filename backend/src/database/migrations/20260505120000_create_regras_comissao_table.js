const PERMISSAO = {
  chave: 'crud_regras_comissao',
  nome: 'Cadastro de regras de comissao',
  descricao: 'Permite criar, editar, listar e desativar regras de comissao por faixa de valor.'
};

exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('regras_comissao');

  if (!existeTabela) {
    await knex.schema.createTable('regras_comissao', function (table) {
      table.increments('id').primary();
      table.decimal('valor_min', 10, 2).notNullable();
      table.decimal('valor_max', 10, 2).notNullable();
      table.decimal('valor_comissao', 10, 2).notNullable();
      table.boolean('ativo').notNullable().defaultTo(true);
      table.integer('ordem').notNullable().defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['ativo', 'valor_min', 'valor_max']);
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

  await knex.schema.dropTableIfExists('regras_comissao');
};
