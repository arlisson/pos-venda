exports.up = async function (knex) {
  const existe = await knex.schema.hasTable('cliente_operadoras');

  if (!existe) {
    await knex.schema.createTable('cliente_operadoras', function (table) {
      table.increments('id').primary();
      table
        .integer('cliente_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('clientes')
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

      table.unique(['cliente_id', 'operadora_id'], 'cliente_operadoras_cliente_operadora_unique');
      table.index(['cliente_id'], 'idx_cliente_operadoras_cliente_id');
      table.index(['operadora_id'], 'idx_cliente_operadoras_operadora_id');
      table.index(['fidelidade_fim'], 'idx_cliente_operadoras_fidelidade_fim');
    });
  }

  await knex('cliente_operadoras')
    .delete()
    .whereIn('cliente_id', knex('clientes').select('id').whereNotNull('operadora_atual_id'));

  await knex.raw(`
    INSERT INTO cliente_operadoras (
      cliente_id,
      operadora_id,
      quantidade_chips,
      valor_pago,
      fidelidade_fim,
      created_at,
      updated_at
    )
    SELECT
      id,
      operadora_atual_id,
      quantidade_chips,
      valor_pago,
      fidelidade_fim,
      created_at,
      updated_at
    FROM clientes
    WHERE operadora_atual_id IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('cliente_operadoras');
};
