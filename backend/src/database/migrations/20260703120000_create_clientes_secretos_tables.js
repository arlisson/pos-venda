exports.up = async function (knex) {
  await knex.schema.createTable('clientes_secretos', function (table) {
    table.increments('id').primary();

    table.string('nome', 240).notNullable();
    table.string('razao_social', 240).nullable();
    table.string('cnpj', 20).nullable();
    table.string('cnpj_digitos', 14).nullable();
    table.string('responsavel_tipo', 20).notNullable().defaultTo('rl');
    table.string('responsavel_nome', 240).nullable();
    table.string('email', 160).nullable();
    table.string('whatsapp_ddd', 4).nullable();
    table.string('whatsapp_numero', 20).nullable();
    table.string('fixo_ddd', 4).nullable();
    table.string('fixo_numero', 20).nullable();
    table.date('fidelidade_fim').nullable();
    table
      .integer('operadora_atual_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('operadoras')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
    table.decimal('valor_pago', 10, 2).nullable();
    table.integer('quantidade_chips').unsigned().nullable();
    table
      .integer('criado_por_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['criado_por_id', 'cnpj_digitos'], 'clientes_secretos_usuario_documento_unique');
    table.index(['criado_por_id'], 'idx_clientes_secretos_criado_por');
    table.index(['cnpj_digitos'], 'idx_clientes_secretos_cnpj_digitos');
    table.index(['created_at'], 'idx_clientes_secretos_created_at');
  });

  await knex.schema.createTable('cliente_secreto_operadoras', function (table) {
    table.increments('id').primary();
    table
      .integer('cliente_secreto_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('clientes_secretos')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .integer('operadora_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('operadoras')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.integer('quantidade_chips').unsigned().nullable();
    table.decimal('valor_pago', 10, 2).nullable();
    table.date('fidelidade_fim').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['cliente_secreto_id', 'operadora_id'], 'cliente_secreto_operadoras_unique');
    table.index(['cliente_secreto_id'], 'idx_cliente_secreto_operadoras_cliente');
    table.index(['operadora_id'], 'idx_cliente_secreto_operadoras_operadora');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('cliente_secreto_operadoras');
  await knex.schema.dropTableIfExists('clientes_secretos');
};
