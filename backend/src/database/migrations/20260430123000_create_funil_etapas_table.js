const ETAPAS_PADRAO = [
  { codigo: 'aprovacao', nome: 'Aprovacao', ordem: 1 },
  { codigo: 'ativacao', nome: 'Ativacao', ordem: 2 },
  { codigo: 'envio', nome: 'Envio / Logistica', ordem: 3 },
  { codigo: 'entrega', nome: 'Entrega', ordem: 4 },
  { codigo: 'confirmacao', nome: 'Confirmacao do cliente', ordem: 5 },
  { codigo: 'concluido', nome: 'Concluido', ordem: 6 }
];

const PERMISSAO = {
  chave: 'crud_funil_etapas',
  nome: 'Funil: gerenciar etapas',
  descricao: 'Permite criar, editar, listar e desativar etapas do funil de vendas.'
};

exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('funil_etapas');

  if (!existeTabela) {
    await knex.schema.createTable('funil_etapas', function (table) {
      table.increments('id').primary();
      table.string('codigo', 40).notNullable().unique();
      table.string('nome', 80).notNullable();
      table.boolean('ativo').notNullable().defaultTo(true);
      table.integer('ordem').notNullable().defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  for (const etapa of ETAPAS_PADRAO) {
    const existente = await knex('funil_etapas')
      .where('codigo', etapa.codigo)
      .first();

    if (existente) {
      await knex('funil_etapas')
        .where('id', existente.id)
        .update({
          nome: etapa.nome,
          ordem: etapa.ordem,
          ativo: true
        });
    } else {
      await knex('funil_etapas').insert({
        ...etapa,
        ativo: true
      });
    }
  }

  const permissaoExistente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (permissaoExistente) {
    await knex('permissoes')
      .where('id', permissaoExistente.id)
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
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('funil_etapas');
};
