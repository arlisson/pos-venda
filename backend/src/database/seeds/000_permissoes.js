const PERMISSOES = [
  {
    id: 1,
    chave: 'vendas',
    nome: 'Vendas',
    descricao: 'Permite acessar a area de vendas.'
  },
  {
    id: 2,
    chave: 'crud_usuarios',
    nome: 'Cadastro de usuarios',
    descricao: 'Permite criar, editar, listar e desativar usuarios.'
  },
  {
    id: 3,
    chave: 'gerenciar_permissoes',
    nome: 'Gerenciar permissoes',
    descricao: 'Permite atribuir e remover permissoes dos usuarios.'
  },
  {
    id: 4,
    chave: 'crud_operadoras',
    nome: 'Cadastro de operadoras',
    descricao: 'Permite criar, editar, listar e desativar operadoras.'
  },
  {
    id: 5,
    chave: 'crud_links',
    nome: 'Cadastro de links',
    descricao: 'Permite criar, editar, listar e desativar links externos.'
  }
];

exports.seed = async function (knex) {
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
      await knex('permissoes').insert(permissao);
    }
  }
};
