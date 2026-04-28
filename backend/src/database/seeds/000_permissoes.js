const PERMISSOES = [
  {
    chave: 'vendas',
    nome: 'Vendas',
    descricao: 'Permite acessar o modulo de vendas. As acoes dependem das subpermissoes.'
  },
  {
    chave: 'vendas_ver_proprias',
    nome: 'Vendas: ver proprias',
    descricao: 'Permite ver vendas criadas pelo usuario ou vinculadas a ele como vendedora.'
  },
  {
    chave: 'vendas_ver_todas',
    nome: 'Vendas: ver todas',
    descricao: 'Permite ver todas as vendas cadastradas.'
  },
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
  },
  {
    chave: 'crud_usuarios',
    nome: 'Cadastro de usuarios',
    descricao: 'Permite acessar o modulo de usuarios. As acoes dependem das subpermissoes.'
  },
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
  },
  {
    chave: 'gerenciar_permissoes',
    nome: 'Gerenciar permissoes',
    descricao: 'Permite atribuir e remover permissoes dos usuarios.'
  },
  {
    chave: 'crud_operadoras',
    nome: 'Cadastro de operadoras',
    descricao: 'Permite criar, editar, listar e desativar operadoras.'
  },
  {
    chave: 'crud_links',
    nome: 'Cadastro de links',
    descricao: 'Permite criar, editar, listar e desativar links externos.'
  },
  {
    chave: 'crud_tipos_venda',
    nome: 'Cadastro de tipos de venda',
    descricao: 'Permite criar, editar, listar e desativar tipos de venda.'
  },
  {
    chave: 'crud_servicos',
    nome: 'Cadastro de servicos',
    descricao: 'Permite criar, editar, listar e desativar servicos.'
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
      await knex('permissoes').insert({
        ...permissao,
        ativo: true
      });
    }
  }
};
