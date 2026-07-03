const PERMISSOES = [
  {
    chave: 'clientes_secretos_ver_todos',
    nome: 'Clientes próprios: visualizar todos',
    descricao: 'Permite acessar e visualizar clientes próprios cadastrados por outros usuarios.'
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

function removerPermissoes(permissoes, chaves) {
  const atuais = parsePermissoes(permissoes);
  chaves.forEach(chave => {
    delete atuais[chave];
  });
  return atuais;
}

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes').where('chave', permissao.chave).first();

    if (existente) {
      await knex('permissoes').where('id', existente.id).update({ ...permissao, ativo: true });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }

  await knex('roles')
    .where('nome', 'admin')
    .then(async roles => {
      for (const role of roles) {
        await knex('roles')
          .where('id', role.id)
          .update({
            permissoes: JSON.stringify(removerPermissoes(role.permissoes, PERMISSOES.map(permissao => permissao.chave))),
            updated_at: knex.fn.now()
          });
      }
    });
};

exports.down = async function (knex) {
  await knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .delete();
};
