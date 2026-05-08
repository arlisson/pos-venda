const PERMISSOES = [
  {
    chave: 'vendas_aprovacoes_visualizar',
    nome: 'Vendas: visualizar aprovacoes',
    descricao: 'Permite acessar a pagina de solicitacoes de liberacao de vendas especiais.'
  },
  {
    chave: 'vendas_aprovacoes_decidir',
    nome: 'Vendas: aprovar solicitacoes',
    descricao: 'Permite aprovar ou recusar solicitacoes de liberacao de vendas especiais.'
  }
];

function parsePermissoes(permissoes) {
  if (!permissoes) return {};

  if (typeof permissoes === 'string') {
    try {
      return JSON.parse(permissoes);
    } catch {
      return {};
    }
  }

  if (Array.isArray(permissoes)) {
    return permissoes.reduce((acc, chave) => ({ ...acc, [chave]: true }), {});
  }

  return permissoes;
}

exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('venda_aprovacao_solicitacoes');

  if (!existeTabela) {
    await knex.schema.createTable('venda_aprovacao_solicitacoes', table => {
      table.increments('id').primary();
      table.integer('venda_id').unsigned().notNullable();
      table.string('status', 40).notNullable().defaultTo('pendente');
      table.json('motivos').nullable();
      table.integer('solicitado_por_id').unsigned().nullable();
      table.integer('decidido_por_id').unsigned().nullable();
      table.text('observacao_decisao').nullable();
      table.timestamp('solicitado_em').notNullable().defaultTo(knex.fn.now());
      table.timestamp('decidido_em').nullable();
      table.timestamps(true, true);

      table.foreign('venda_id').references('id').inTable('vendas').onDelete('CASCADE');
      table.foreign('solicitado_por_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.foreign('decidido_por_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['venda_id', 'status']);
      table.index(['status', 'solicitado_em']);
    });
  }

  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes').where('chave', permissao.chave).first();

    if (existente) {
      await knex('permissoes')
        .where('id', existente.id)
        .update({ ...permissao, ativo: true });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }

  const roleAdmin = await knex('roles').where('nome', 'admin').first();

  if (roleAdmin) {
    const permissoes = parsePermissoes(roleAdmin.permissoes);

    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...permissoes,
          vendas_aprovacoes_visualizar: true,
          vendas_aprovacoes_decidir: true
        })
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('venda_aprovacao_solicitacoes');
};
