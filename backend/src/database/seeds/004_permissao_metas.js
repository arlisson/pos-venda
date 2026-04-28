function parsePermissoes(permissoes) {
  if (!permissoes) {
    return {};
  }

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof permissoes === 'object' && !Array.isArray(permissoes) ? permissoes : {};
}

exports.seed = async function(knex) {
  await knex('permissoes').insert({
    chave: 'gerenciar_metas',
    nome: 'Gerenciar Metas',
    descricao: 'Permite configurar as metas globais e de gamificacao',
    ativo: true
  }).onConflict('chave').merge({
    nome: 'Gerenciar Metas',
    descricao: 'Permite configurar as metas globais e de gamificacao',
    ativo: true
  });

  const roleAdmin = await knex('roles').where('nome', 'admin').first();

  if (roleAdmin) {
    const permissoes = parsePermissoes(roleAdmin.permissoes);

    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...permissoes,
          gerenciar_metas: true
        }),
        updated_at: knex.fn.now()
      });
  }
};
