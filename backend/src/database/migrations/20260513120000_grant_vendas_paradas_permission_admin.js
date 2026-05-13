const PERMISSAO = {
  chave: 'notificacoes_vendas_paradas',
  nome: 'Notificacoes: vendas paradas no funil',
  descricao: 'Permite receber notificacoes de vendas paradas por 5+ dias corridos no mesmo estagio do funil.'
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

async function upsertPermissao(knex) {
  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    return knex('permissoes')
      .where('id', existente.id)
      .update({ ...PERMISSAO, ativo: true });
  }

  return knex('permissoes').insert({ ...PERMISSAO, ativo: true });
}

async function atualizarRole(knex, nomeRole, permissoesAtivas) {
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
  await upsertPermissao(knex);
  await atualizarRole(knex, 'admin', { notificacoes_vendas_paradas: true });
  await atualizarRole(knex, 'usuario', { notificacoes_vendas_paradas: false });
};

exports.down = async function (knex) {
  await atualizarRole(knex, 'usuario', { notificacoes_vendas_paradas: false });
};
