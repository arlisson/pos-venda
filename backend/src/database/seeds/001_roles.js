function montarPermissoes(permissoes, permissoesLiberadas = []) {
  return permissoes.reduce((acc, permissao) => {
    acc[permissao.chave] = permissoesLiberadas.includes(permissao.chave);
    return acc;
  }, {});
}

exports.seed = async function (knex) {
  await knex('usuarios').del();
  await knex('roles').del();

  const permissoes = await knex('permissoes')
    .select('chave')
    .where('ativo', true)
    .orderBy('chave', 'asc');

  const todasPermissoes = permissoes.map((permissao) => permissao.chave);

  await knex('roles').insert([
    {
      id: 1,
      nome: 'admin',
      descricao: 'Administrador do sistema com acesso total.',
      permissoes: JSON.stringify(
        montarPermissoes(permissoes, todasPermissoes)
      )
    },
    {
      id: 2,
      nome: 'usuario',
      descricao: 'Usuário comum com acesso limitado ao sistema.',
      permissoes: JSON.stringify(
        montarPermissoes(permissoes, [])
      )
    }
  ]);
};