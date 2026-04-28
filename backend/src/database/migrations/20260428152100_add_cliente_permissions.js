const PERMISSOES = [
  {
    chave: 'clientes_ver_proprios',
    nome: 'Clientes: ver proprios',
    descricao: 'Permite visualizar clientes cadastrados pelo proprio usuario.'
  },
  {
    chave: 'clientes_ver_todos',
    nome: 'Clientes: ver todos',
    descricao: 'Permite visualizar todos os clientes cadastrados.'
  },
  {
    chave: 'clientes_criar',
    nome: 'Clientes: criar',
    descricao: 'Permite cadastrar novos clientes.'
  },
  {
    chave: 'clientes_editar',
    nome: 'Clientes: editar',
    descricao: 'Permite editar clientes acessiveis pelo usuario.'
  },
  {
    chave: 'clientes_excluir',
    nome: 'Clientes: excluir',
    descricao: 'Permite excluir clientes acessiveis pelo usuario.'
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
          ativo: true,
          updated_at: knex.fn.now()
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
