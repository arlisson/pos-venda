const PERMISSAO = {
  chave: 'crud_tipos_produto',
  nome: 'Cadastro de tipos de produto',
  descricao: 'Permite criar, editar, listar e desativar tipos de produto.'
};

exports.up = async function (knex) {
  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    return knex('permissoes')
      .where('id', existente.id)
      .update({
        nome: PERMISSAO.nome,
        descricao: PERMISSAO.descricao,
        ativo: true
      });
  }

  return knex('permissoes').insert({
    ...PERMISSAO,
    ativo: true
  });
};

exports.down = function (knex) {
  return knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .del();
};
