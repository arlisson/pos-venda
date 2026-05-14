const PERMISSAO = {
  chave: 'notificacoes_receber_email',
  nome: 'Notificacoes: receber por email',
  descricao: 'Permite receber por email as notificacoes destinadas ao usuario.'
};

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

async function atualizarRole(knex, nomeRole, permissoesAtivas) {
  const role = await knex('roles').where('nome', nomeRole).first();
  if (!role) return;

  await knex('roles')
    .where('id', role.id)
    .update({
      permissoes: JSON.stringify({
        ...parsePermissoes(role.permissoes),
        ...permissoesAtivas
      })
    });
}

exports.up = async function (knex) {
  const existente = await knex('permissoes').where('chave', PERMISSAO.chave).first();

  if (existente) {
    await knex('permissoes').where('id', existente.id).update({ ...PERMISSAO, ativo: true });
  } else {
    await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
  }

  await atualizarRole(knex, 'admin', { [PERMISSAO.chave]: true });
  await atualizarRole(knex, 'usuario', { [PERMISSAO.chave]: false });
};

exports.down = async function (knex) {
  await atualizarRole(knex, 'admin', { [PERMISSAO.chave]: false });
  await atualizarRole(knex, 'usuario', { [PERMISSAO.chave]: false });
  await knex('permissoes').where('chave', PERMISSAO.chave).update({ ativo: false });
};
