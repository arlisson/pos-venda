const PERMISSOES = [
  {
    chave: 'vendas',
    nome: 'Vendas',
    descricao: 'Permite acessar o módulo de vendas. As ações dependem das subpermissões.'
  },
  {
    chave: 'vendas_ver_proprias',
    nome: 'Vendas: ver próprias',
    descricao: 'Permite ver vendas criadas pelo usuário ou vinculadas a ele como vendedora.'
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
    descricao: 'Permite editar vendas que o usuário pode acessar.'
  },
  {
    chave: 'vendas_excluir',
    nome: 'Vendas: excluir',
    descricao: 'Permite excluir vendas que o usuário pode acessar.'
  },
  {
    chave: 'funil_vendas',
    nome: 'Funil de vendas',
    descricao: 'Permite acessar a página do funil de vendas.'
  },
  {
    chave: 'crud_funil_etapas',
    nome: 'Funil: gerenciar etapas',
    descricao: 'Permite criar, editar, listar e desativar etapas do funil de vendas.'
  },
  {
    chave: 'dashboard_resumo_vendas',
    nome: 'Início: resumo de vendas',
    descricao: 'Permite visualizar os cards de resumo de vendas na página inicial.'
  },
  {
    chave: 'metas_ver_usuarios',
    nome: 'Metas: ver por usuário',
    descricao: 'Permite acompanhar no dashboard quais usuários bateram ou não as metas.'
  },
  {
    chave: 'relatorios_visualizar',
    nome: 'Relatórios: visualizar',
    descricao: 'Permite acessar a página de relatórios comerciais.'
  },
  {
    chave: 'crud_usuarios',
    nome: 'Cadastro de usuários',
    descricao: 'Permite acessar o módulo de usuários. As ações dependem das subpermissões.'
  },
  {
    chave: 'usuarios_listar',
    nome: 'Usuários: listar',
    descricao: 'Permite visualizar usuários cadastrados.'
  },
  {
    chave: 'usuarios_criar',
    nome: 'Usuários: criar',
    descricao: 'Permite criar novos usuários.'
  },
  {
    chave: 'usuarios_editar',
    nome: 'Usuários: editar',
    descricao: 'Permite editar dados de usuários.'
  },
  {
    chave: 'usuarios_excluir',
    nome: 'Usuários: excluir',
    descricao: 'Permite excluir usuários comuns.'
  },
  {
    chave: 'gerenciar_permissoes',
    nome: 'Gerenciar permissões',
    descricao: 'Permite atribuir e remover permissões dos usuários.'
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
    nome: 'Cadastro de serviços',
    descricao: 'Permite criar, editar, listar e desativar serviços.'
  },
  {
    chave: 'historico_visualizar',
    nome: 'Histórico: visualizar',
    descricao: 'Permite visualizar a página de histórico do sistema.'
  },
  {
    chave: 'clientes_ver_proprios',
    nome: 'Clientes: ver próprios',
    descricao: 'Permite visualizar clientes cadastrados pelo próprio usuário.'
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
    descricao: 'Permite editar clientes acessíveis pelo usuário.'
  },
  {
    chave: 'clientes_excluir',
    nome: 'Clientes: excluir',
    descricao: 'Permite excluir clientes acessíveis pelo usuário.'
  },
  {
    chave: 'notificacoes_visualizar',
    nome: 'Notificações: visualizar',
    descricao: 'Permite visualizar as próprias notificações do sistema.'
  },
  {
    chave: 'notificacoes_receber_todas',
    nome: 'Notificações: receber todas',
    descricao: 'Permite receber todas as notificações geradas pelo sistema.'
  },
  {
    chave: 'gerenciar_leads',
    nome: 'Gerenciar leads',
    descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.'
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
