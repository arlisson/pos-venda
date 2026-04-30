exports.up = async function (knex) {
  await knex.schema.createTable('lead_planilhas', function (table) {
    table.increments('id').primary();
    table.string('nome', 240).notNullable();
    table.json('colunas').notNullable();
    table.json('schema_colunas').notNullable();
    table.integer('total_linhas').unsigned().notNullable().defaultTo(0);
    table
      .integer('criado_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['criado_por_id']);
  });

  await knex.schema.createTable('lead_envios', function (table) {
    table.increments('id').primary();
    table.string('nome', 240).notNullable();
    table.integer('total_linhas').unsigned().notNullable().defaultTo(0);
    table.json('colunas_visiveis').nullable();
    table
      .integer('criado_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['criado_por_id']);
  });

  await knex.schema.createTable('lead_linhas', function (table) {
    table.increments('id').primary();
    table
      .integer('planilha_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('lead_planilhas')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.integer('row_index').unsigned().notNullable();
    table.json('dados_json').notNullable();
    table
      .integer('atribuido_para_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table
      .integer('envio_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('lead_envios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['planilha_id']);
    table.index(['atribuido_para_id']);
    table.index(['envio_id']);
  });

  await knex.schema.createTable('lead_envio_usuarios', function (table) {
    table.increments('id').primary();
    table
      .integer('envio_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('lead_envios')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .integer('usuario_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.integer('quantidade').unsigned().notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['envio_id', 'usuario_id']);
    table.index(['usuario_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('lead_envio_usuarios');
  await knex.schema.dropTableIfExists('lead_linhas');
  await knex.schema.dropTableIfExists('lead_envios');
  await knex.schema.dropTableIfExists('lead_planilhas');
};
