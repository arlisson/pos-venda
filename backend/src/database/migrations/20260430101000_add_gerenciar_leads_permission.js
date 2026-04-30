exports.up = async function (knex) {
  const existente = await knex('permissoes')
    .where('chave', 'gerenciar_leads')
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({
        nome: 'Gerenciar leads',
        descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.',
        ativo: true
      });
  } else {
    await knex('permissoes').insert({
      chave: 'gerenciar_leads',
      nome: 'Gerenciar leads',
      descricao: 'Permite importar planilhas, filtrar e distribuir leads entre vendedores.',
      ativo: true
    });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', 'gerenciar_leads')
    .delete();
};
