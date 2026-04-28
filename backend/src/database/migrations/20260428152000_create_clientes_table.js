exports.up = async function (knex) {
  await knex.schema.createTable('clientes', function (table) {
    table.increments('id').primary();

    table.string('nome', 240).notNullable();
    table.string('razao_social', 240).nullable();
    table.string('cnpj', 20).nullable();
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
    table.integer('quantidade_chips').unsigned().nullable();
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
    table.index(['cnpj']);
    table.index(['fidelidade_fim']);
  });

  return knex.schema.alterTable('vendas', function (table) {
    table
      .integer('cliente_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('clientes')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('cliente_id');
  });

  return knex.schema.dropTableIfExists('clientes');
};
