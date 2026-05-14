const PERMISSAO = {
  chave: 'campanhas_visualizar',
  nome: 'Campanhas: visualizar',
  descricao: 'Permite visualizar a secao de campanhas e recompensas na pagina inicial.'
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
      .update({
        nome: PERMISSAO.nome,
        descricao: PERMISSAO.descricao,
        ativo: true
      });
  } else {
    await knex('permissoes').insert({
      ...PERMISSAO,
      ativo: true
    });
  }

  const roleAdmin = await knex('roles')
    .where('nome', 'admin')
    .first();

  if (roleAdmin) {
    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(roleAdmin.permissoes),
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
