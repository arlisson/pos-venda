const PERMISSOES = [
  {
    chave: 'clientes_secretos_ver',
    nome: 'Clientes próprios: visualizar',
    descricao: 'Permite acessar e visualizar os clientes próprios cadastrados pelo proprio usuario.'
  },
  {
    chave: 'clientes_secretos_criar',
    nome: 'Clientes próprios: criar',
    descricao: 'Permite cadastrar novos clientes próprios.'
  },
  {
    chave: 'clientes_secretos_editar',
    nome: 'Clientes próprios: editar',
    descricao: 'Permite editar clientes próprios cadastrados pelo proprio usuario.'
  },
  {
    chave: 'clientes_secretos_excluir',
    nome: 'Clientes próprios: excluir',
    descricao: 'Permite excluir clientes próprios cadastrados pelo proprio usuario.'
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
