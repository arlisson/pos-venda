const PERMISSAO = {
  chave: 'vendas_limitar_ultimos_6_meses',
  nome: 'Vendas: limitar aos ultimos 6 meses',
  descricao: 'Limita a listagem, busca e exportacao de vendas as vendas dos ultimos 6 meses.'
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
  } else {
    await knex('permissoes').insert({
      ...PERMISSAO,
      ativo: true
    });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .delete();
};