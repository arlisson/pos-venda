exports.up = async function (knex) {
  const permissao = {
    chave: 'clientes_atribuir_vendedora',
    nome: 'Clientes: atribuir vendedora',
    descricao: 'Permite definir qual usuario sera o dono do cliente para acesso e registro de vendas.',
    ativo: true
  };

  const existente = await knex('permissoes')
    .where('chave', permissao.chave)
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({
        nome: permissao.nome,
        descricao: permissao.descricao,
        ativo: true
      });
  } else {
    await knex('permissoes').insert(permissao);
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', 'clientes_atribuir_vendedora')
    .delete();
};
