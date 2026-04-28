const PERMISSOES = [
  {
    chave: 'vendas_criar',
    nome: 'Vendas: criar',
    descricao: 'Permite registrar novas vendas.'
  },
  {
    chave: 'vendas_editar',
    nome: 'Vendas: editar',
    descricao: 'Permite editar vendas que o usuario pode acessar.'
  },
  {
    chave: 'vendas_excluir',
    nome: 'Vendas: excluir',
    descricao: 'Permite excluir vendas que o usuario pode acessar.'
  }
];

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes')
      .where('chave', permissao.chave)
      .first();

    if (existente) {
      await knex('permissoes')
        .where('id', existente.id)
        .update({
          nome: permissao.nome,
          descricao: permissao.descricao,
          ativo: true
        });
    } else {
      await knex('permissoes').insert({
        ...permissao,
        ativo: true
      });
    }
  }
};

exports.down = function (knex) {
  return knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .del();
};
