const PERMISSAO = {
  chave: 'vendas_fechamento_mensal',
  nome: 'Vendas: fechamento mensal',
  descricao: 'Permite acessar a pagina de fechamento mensal de vendas e gerenciar planos com taxa de comissao.'
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

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });
};
