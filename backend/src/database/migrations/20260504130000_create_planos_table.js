exports.up = function (knex) {
  return knex.schema.createTable('planos', function (table) {
    table.increments('id').primary();

    table.string('nome', 120).notNullable();

    table
      .integer('operadora_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('operadoras')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table.enu('categoria', ['movel', 'fixo', 'internet']).notNullable();
    table.enu('tipo_servico', ['novo', 'portabilidade']).notNullable();

    table.decimal('taxa_comissao', 5, 2).notNullable().defaultTo(0);

    table.boolean('ativo').notNullable().defaultTo(true);
    table.integer('ordem').notNullable().defaultTo(0);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['operadora_id', 'nome']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('planos');
};
