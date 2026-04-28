const PERMISSAO = {
  chave: 'historico_visualizar',
  nome: 'Historico: visualizar',
  descricao: 'Permite visualizar a pagina de historico do sistema.'
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
        ativo: true,
        updated_at: knex.fn.now()
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
