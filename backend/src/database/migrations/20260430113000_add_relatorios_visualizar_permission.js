const PERMISSAO = {
  chave: 'relatorios_visualizar',
  nome: 'Relatorios: visualizar',
  descricao: 'Permite acessar a pagina de relatorios comerciais.'
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
