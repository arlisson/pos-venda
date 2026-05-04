const PERMISSOES = [
  {
    chave: 'notificacoes_visualizar',
    nome: 'Notificacoes: visualizar',
    descricao: 'Permite visualizar as proprias notificacoes do sistema.'
  },
  {
    chave: 'notificacoes_receber_todas',
    nome: 'Notificacoes: receber todas',
    descricao: 'Permite receber todas as notificacoes geradas pelo sistema.'
  }
];

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

async function upsertPermissao(knex, permissao) {
  const existente = await knex('permissoes')
    .where('chave', permissao.chave)
    .first();

  if (existente) {
    return knex('permissoes')
      .where('id', existente.id)
      .update({
        ...permissao,
        ativo: true
      });
  }

  return knex('permissoes').insert({
    ...permissao,
    ativo: true
  });
}

async function atualizarPermissoesRole(knex, nomeRole, permissoesAtivas) {
  const role = await knex('roles')
    .where('nome', nomeRole)
    .first();

  if (!role) return;

  await knex('roles')
    .where('id', role.id)
    .update({
      permissoes: JSON.stringify({
        ...parsePermissoes(role.permissoes),
        ...permissoesAtivas
      }),
      updated_at: knex.fn.now()
    });
}

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    await upsertPermissao(knex, permissao);
  }

  await atualizarPermissoesRole(knex, 'admin', {
    notificacoes_visualizar: true,
    notificacoes_receber_todas: true
  });

  await atualizarPermissoesRole(knex, 'usuario', {
    notificacoes_visualizar: false,
    notificacoes_receber_todas: false
  });
};

exports.down = async function (knex) {
  await knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .update({ ativo: false });
};
