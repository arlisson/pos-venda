const PERMISSOES = [
  {
    chave: 'vendas_ver_proprias',
    nome: 'Vendas: ver proprias',
    descricao: 'Permite ver vendas criadas pelo usuario ou vinculadas a ele como vendedora.'
  },
  {
    chave: 'vendas_ver_todas',
    nome: 'Vendas: ver todas',
    descricao: 'Permite ver todas as vendas cadastradas.'
  }
];

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
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
      await knex('permissoes').insert({
        ...permissao,
        ativo: true
      });
    }
  }

  return knex.schema.alterTable('vendas', function (table) {
    table
      .integer('criado_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropForeign(['criado_por_id']);
    table.dropColumn('criado_por_id');
  });

  return knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .del();
};
