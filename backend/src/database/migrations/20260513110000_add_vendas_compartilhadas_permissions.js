const PERMISSOES = [
  {
    chave: 'compartilhar_venda',
    nome: 'Vendas: compartilhar',
    descricao: 'Permite vincular outras vendedoras a uma venda.'
  },
  {
    chave: 'ver_vendas_compartilhadas',
    nome: 'Vendas: ver compartilhadas',
    descricao: 'Permite ver vendas compartilhadas em que o usuario esta vinculado como vendedor.'
  },
  {
    chave: 'editar_vendas_compartilhadas',
    nome: 'Vendas: editar compartilhadas',
    descricao: 'Permite editar vendas compartilhadas em que o usuario esta vinculado como vendedor.'
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
      await knex('permissoes')
        .where('chave', permissao.chave)
        .update({ nome: permissao.nome, descricao: permissao.descricao, ativo: true });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }

  const roleAdmin = await knex('roles').where('nome', 'admin').first();
  if (roleAdmin) {
    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(roleAdmin.permissoes),
          compartilhar_venda: true,
          ver_vendas_compartilhadas: true,
          editar_vendas_compartilhadas: true
        })
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes').whereIn('chave', PERMISSOES.map(permissao => permissao.chave)).delete();
};
