const PERMISSAO = {
  chave: 'pos_venda',
  nome: 'Pós-venda',
  descricao: 'Permite editar vendas já enviadas ao pós-venda e operar o funil.'
};

exports.up = async function (knex) {
  const hasEnviadaEm = await knex.schema.hasColumn('vendas', 'enviada_pos_venda_em');
  const hasEnviadaPor = await knex.schema.hasColumn('vendas', 'enviada_pos_venda_por_id');

  await knex.schema.alterTable('vendas', function (table) {
    if (!hasEnviadaEm) {
      table.timestamp('enviada_pos_venda_em').nullable().index();
    }

    if (!hasEnviadaPor) {
      table
        .integer('enviada_pos_venda_por_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('usuarios')
        .onUpdate('CASCADE')
        .onDelete('SET NULL');
    }
  });

  await knex.schema.alterTable('vendas', function (table) {
    table.string('status_funil', 40).nullable().defaultTo(null).alter();
  });

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
  await knex('vendas')
    .whereNull('status_funil')
    .update({ status_funil: 'aprovacao' });

  await knex.schema.alterTable('vendas', function (table) {
    table.string('status_funil', 40).notNullable().defaultTo('aprovacao').alter();
  });

  const hasEnviadaPor = await knex.schema.hasColumn('vendas', 'enviada_pos_venda_por_id');
  const hasEnviadaEm = await knex.schema.hasColumn('vendas', 'enviada_pos_venda_em');

  await knex.schema.alterTable('vendas', function (table) {
    if (hasEnviadaPor) {
      table.dropForeign(['enviada_pos_venda_por_id']);
      table.dropColumn('enviada_pos_venda_por_id');
    }

    if (hasEnviadaEm) {
      table.dropColumn('enviada_pos_venda_em');
    }
  });

  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });
};
