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
    chave: 'gerenciar_leads',
    nome: 'Gerenciar leads',
    descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.'
  }
];

const PERMISSOES_SEM_ACENTO = [
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
    chave: 'funil_vendas',
    nome: 'Funil de vendas',
    descricao: 'Permite acessar a pagina do funil de vendas.'
  },
  {
    chave: 'crud_funil_etapas',
    nome: 'Funil: gerenciar etapas',
    descricao: 'Permite criar, editar, listar e desativar etapas do funil de vendas.'
  },
  {
    chave: 'dashboard_resumo_vendas',
    nome: 'Inicio: resumo de vendas',
    descricao: 'Permite visualizar os cards de resumo de vendas na pagina inicial.'
  },
  {
    chave: 'metas_ver_usuarios',
    nome: 'Metas: ver por usuario',
    descricao: 'Permite acompanhar no dashboard quais usuarios bateram ou nao as metas.'
  },
  {
    chave: 'relatorios_visualizar',
    nome: 'Relatorios: visualizar',
    descricao: 'Permite acessar a pagina de relatorios comerciais.'
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
  },
  {
    chave: 'historico_visualizar',
    nome: 'Historico: visualizar',
    descricao: 'Permite visualizar a pagina de historico do sistema.'
  },
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
  },
  {
    chave: 'gerenciar_leads',
    nome: 'Gerenciar leads',
    descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.'
  }
];

async function atualizarTextos(knex, permissoes) {
  for (const permissao of permissoes) {
    await knex('permissoes')
      .where('chave', permissao.chave)
      .update({
        nome: permissao.nome,
        descricao: permissao.descricao
      });
  }
}

exports.up = async function (knex) {
  await atualizarTextos(knex, PERMISSOES);
};

exports.down = async function (knex) {
  await atualizarTextos(knex, PERMISSOES_SEM_ACENTO);
};
