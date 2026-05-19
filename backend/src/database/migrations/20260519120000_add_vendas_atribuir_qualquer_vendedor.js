exports.up = async function (knex) {
  const permissao = {
    chave: 'vendas_atribuir_qualquer_vendedor',
    nome: 'Vendas: atribuir qualquer vendedor',
    descricao: 'Permite registrar vendas no nome de qualquer vendedor, podendo não se incluir na venda.',
    ativo: true
  };

  const existente = await knex('permissoes').where('chave', permissao.chave).first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({ nome: permissao.nome, descricao: permissao.descricao, ativo: true });
  } else {
    await knex('permissoes').insert(permissao);
  }
};

exports.down = async function (knex) {
  await knex('permissoes').where('chave', 'vendas_atribuir_qualquer_vendedor').delete();
};
