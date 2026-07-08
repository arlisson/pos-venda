const PERMISSOES = [
  {
    chave: 'clientes_antigos_buscar',
    nome: 'Clientes antigos: buscar',
    descricao: 'Permite acessar a busca de clientes antigos e consultar vendas antigas por CNPJ.'
  },
  {
    chave: 'clientes_antigos_gerenciar',
    nome: 'Clientes antigos: gerenciar base',
    descricao: 'Permite fazer upload das planilhas de vendas antigas na aba de configuracoes.'
  },
  {
    chave: 'clientes_antigos_ver_historico',
    nome: 'Clientes antigos: ver historico',
    descricao: 'Permite visualizar o historico de buscas de clientes antigos de todos os usuarios.'
  }
];

function parsePermissoes(permissoes) {
  if (!permissoes) return {};
  if (typeof permissoes === 'string') {
    try {
      return parsePermissoes(JSON.parse(permissoes));
    } catch {
      return {};
    }
  }
  if (Array.isArray(permissoes)) {
    return permissoes.reduce((acc, chave) => ({ ...acc, [chave]: true }), {});
  }
  return permissoes;
}

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes').where('chave', permissao.chave).first();

    if (existente) {
      await knex('permissoes').where('id', existente.id).update({ ...permissao, ativo: true });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }

  const roleAdmin = await knex('roles').where('nome', 'admin').first();
  if (roleAdmin) {
    const atuais = parsePermissoes(roleAdmin.permissoes);
    const novas = PERMISSOES.reduce((acc, permissao) => {
      acc[permissao.chave] = true;
      return acc;
    }, {});

    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({ ...atuais, ...novas }),
        updated_at: knex.fn.now()
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .delete();
};
