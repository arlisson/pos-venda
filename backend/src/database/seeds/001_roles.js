exports.seed = async function (knex) {
  await knex('usuarios').del();
  await knex('roles').del();

  await knex('roles').insert([
    {
      id: 1,
      nome: 'admin',
      descricao: 'Administrador do sistema com acesso total.',
      permissoes: JSON.stringify({
        vendas: true,
        crud_usuarios: true,
      })
    },
    {
      id: 2,
      nome: 'usuario',
      descricao: 'Usuário comum com acesso limitado ao sistema.',
      permissoes: JSON.stringify({
        vendas: false,  
        crud_usuarios: false,
      })
    }
  ]);
};