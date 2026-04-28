const PERMISSOES = [
  {
    id: 1,
    chave: 'vendas',
    nome: 'Vendas',
    descricao: 'Permite acessar o modulo de vendas. As acoes dependem das subpermissoes.'
  },
  {
    id: 2,
    chave: 'vendas_ver_proprias',
    nome: 'Vendas: ver proprias',
    descricao: 'Permite ver vendas criadas pelo usuario ou vinculadas a ele como vendedora.'
  },
  {
    id: 3,
    chave: 'vendas_ver_todas',
    nome: 'Vendas: ver todas',
    descricao: 'Permite ver todas as vendas cadastradas.'
  },
  {
    id: 4,
    chave: 'vendas_criar',
    nome: 'Vendas: criar',
    descricao: 'Permite registrar novas vendas.'
  },
  {
    id: 5,
    chave: 'vendas_editar',
    nome: 'Vendas: editar',
    descricao: 'Permite editar vendas que o usuario pode acessar.'
  },
  {
    id: 6,
    chave: 'vendas_excluir',
    nome: 'Vendas: excluir',
    descricao: 'Permite excluir vendas que o usuario pode acessar.'
  },
  {
    id: 7,
    chave: 'crud_usuarios',
    nome: 'Cadastro de usuarios',
    descricao: 'Permite acessar o modulo de usuarios. As acoes dependem das subpermissoes.'
  },
  {
    id: 8,
    chave: 'usuarios_listar',
    nome: 'Usuarios: listar',
    descricao: 'Permite visualizar usuarios cadastrados.'
  },
  {
    id: 9,
    chave: 'usuarios_criar',
    nome: 'Usuarios: criar',
    descricao: 'Permite criar novos usuarios.'
  },
  {
    id: 10,
    chave: 'usuarios_editar',
    nome: 'Usuarios: editar',
    descricao: 'Permite editar dados de usuarios.'
  },
  {
    id: 11,
    chave: 'usuarios_excluir',
    nome: 'Usuarios: excluir',
    descricao: 'Permite excluir usuarios comuns.'
  },
  {
    id: 12,
    chave: 'gerenciar_permissoes',
    nome: 'Gerenciar permissoes',
    descricao: 'Permite atribuir e remover permissoes dos usuarios.'
  },
  {
    id: 13,
    chave: 'crud_operadoras',
    nome: 'Cadastro de operadoras',
    descricao: 'Permite criar, editar, listar e desativar operadoras.'
  },
  {
    id: 14,
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
