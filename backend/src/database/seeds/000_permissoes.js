exports.seed = async function (knex) {
  await knex('permissoes').del();

  await knex('permissoes').insert([
    {
      id: 1,
      chave: 'vendas',
      nome: 'Vendas',
      descricao: 'Permite acessar a área de vendas.'
    },
    {
      id: 2,
      chave: 'crud_usuarios',
      nome: 'Cadastro de usuários',
      descricao: 'Permite criar, editar, listar e desativar usuários.'
    }
  ]);
};