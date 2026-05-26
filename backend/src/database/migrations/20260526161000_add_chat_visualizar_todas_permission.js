const PERMISSAO = {
  chave: 'chat_visualizar_todas',
  nome: 'Chat: visualizar todas',
  descricao: 'Permite acessar a aba de chat e visualizar todas as conversas internas do sistema.'
};

function parsePermissoes(permissoes) {
  if (!permissoes) return {};

  if (typeof permissoes === 'string') {
    try {
      return JSON.parse(permissoes);
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
  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({ ...PERMISSAO, ativo: true });
  } else {
    await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
  }

  const admin = await knex('roles').where('nome', 'admin').first();
  if (admin) {
    await knex('roles')
      .where('id', admin.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(admin.permissoes),
          [PERMISSAO.chave]: true
        })
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });
};
