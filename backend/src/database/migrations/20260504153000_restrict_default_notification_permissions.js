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

async function atualizarRole(knex, nomeRole, permissoes) {
  const role = await knex('roles')
    .where('nome', nomeRole)
    .first();

  if (!role) return;

  await knex('roles')
    .where('id', role.id)
    .update({
      permissoes: JSON.stringify({
        ...parsePermissoes(role.permissoes),
        ...permissoes
      }),
      updated_at: knex.fn.now()
    });
}

exports.up = async function (knex) {
  await atualizarRole(knex, 'admin', {
    notificacoes_visualizar: true,
    notificacoes_receber_todas: true
  });

  await atualizarRole(knex, 'usuario', {
    notificacoes_visualizar: false,
    notificacoes_receber_todas: false
  });
};

exports.down = async function (knex) {
  await atualizarRole(knex, 'usuario', {
    notificacoes_visualizar: true
  });
};
