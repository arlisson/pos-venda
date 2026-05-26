const PERMISSAO_CHAT = 'chat_usar';

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
    return permissoes.reduce((acc, chave) => {
      acc[chave] = true;
      return acc;
    }, {});
  }

  return permissoes;
}

exports.up = async function (knex) {
  const roleUsuario = await knex('roles').where('nome', 'usuario').first();
  if (!roleUsuario) return;

  const permissoes = parsePermissoes(roleUsuario.permissoes);
  if (permissoes[PERMISSAO_CHAT] !== true) return;

  delete permissoes[PERMISSAO_CHAT];

  await knex('roles')
    .where('id', roleUsuario.id)
    .update({
      permissoes: JSON.stringify(permissoes),
      updated_at: knex.fn.now()
    });
};

exports.down = async function (knex) {
  const roleUsuario = await knex('roles').where('nome', 'usuario').first();
  if (!roleUsuario) return;

  await knex('roles')
    .where('id', roleUsuario.id)
    .update({
      permissoes: JSON.stringify({
        ...parsePermissoes(roleUsuario.permissoes),
        [PERMISSAO_CHAT]: true
      }),
      updated_at: knex.fn.now()
    });
};
