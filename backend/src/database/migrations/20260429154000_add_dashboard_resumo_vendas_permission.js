const PERMISSAO = {
  chave: 'dashboard_resumo_vendas',
  nome: 'Inicio: resumo de vendas',
  descricao: 'Permite visualizar os cards de resumo de vendas na pagina inicial.'
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
