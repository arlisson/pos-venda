exports.up = async function (knex) {
  await knex.schema.createTable('tipos_venda', function (table) {
    table.increments('id').primary();
    table.string('nome', 80).notNullable().unique();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('servicos', function (table) {
    table.increments('id').primary();
    table.string('nome', 80).notNullable().unique();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('tipos_venda').insert([
    { nome: 'Novo', ordem: 1 },
    { nome: 'Portabilidade', ordem: 2 }
  ]);

  await knex('servicos').insert([
    { nome: 'Internet', ordem: 1 },
    { nome: 'Telefonia fixa', ordem: 2 },
    { nome: 'Telefonia móvel', ordem: 3 }
  ]);

  await knex.schema.alterTable('vendas', function (table) {
    table
      .integer('tipo_venda_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('tipos_venda')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');

    table
      .integer('servico_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('servicos')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');
  });

  await knex('permissoes').where('chave', 'crud_tipos_produto').update({ ativo: false });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('servico_id');
    table.dropColumn('tipo_venda_id');
  });

  await knex.schema.dropTableIfExists('servicos');
  await knex.schema.dropTableIfExists('tipos_venda');
  await knex('permissoes').where('chave', 'crud_tipos_produto').update({ ativo: true });
};
