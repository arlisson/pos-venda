const PERMISSOES = [
  {
    chave: 'usuarios_listar',
    nome: 'Usuarios: listar',
    descricao: 'Permite visualizar usuarios cadastrados.'
  },
  {
    chave: 'usuarios_criar',
    nome: 'Usuarios: criar',
    descricao: 'Permite criar novos usuarios.'
  },
  {
    chave: 'usuarios_editar',
    nome: 'Usuarios: editar',
    descricao: 'Permite editar dados de usuarios.'
  },
  {
    chave: 'usuarios_excluir',
    nome: 'Usuarios: excluir',
    descricao: 'Permite excluir usuarios comuns.'
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
