const PERMISSAO = {
  chave: 'gerenciar_metas',
  nome: 'Gerenciar Metas',
  descricao: 'Permite configurar as metas globais e de gamificacao',
  ativo: true
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
  return permissoes;
}

exports.seed = async function (knex) {
  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({
        nome: PERMISSAO.nome,
        descricao: PERMISSAO.descricao,
        ativo: true,
        updated_at: knex.fn.now()
      });
  } else {
    await knex('permissoes').insert(PERMISSAO);
  }

  const roleAdmin = await knex('roles')
    .where('nome', 'admin')
    .first();

  if (!roleAdmin) {
    return;
  }

  await knex('roles')
    .where('id', roleAdmin.id)
    .update({
      permissoes: JSON.stringify({
        ...parsePermissoes(roleAdmin.permissoes),
        [PERMISSAO.chave]: true
      }),
      updated_at: knex.fn.now()
    });
};
