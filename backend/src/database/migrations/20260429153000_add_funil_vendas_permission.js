const PERMISSAO = {
  chave: 'funil_vendas',
  nome: 'Funil de vendas',
  descricao: 'Permite acessar a pagina do funil de vendas.'
};

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
    return;
  }

  await knex('permissoes').insert({
    ...PERMISSAO,
    ativo: true
  });
};

exports.down = function (knex) {
  return knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .del();
};
