exports.up = async function (knex) {
  const existe = await knex.schema.hasTable('venda_historicos');

  if (!existe) {
    await knex.schema.createTable('venda_historicos', function (table) {
      table.increments('id').primary();

      table
        .integer('venda_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('vendas')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

      table
        .integer('usuario_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('usuarios')
        .onUpdate('CASCADE')
        .onDelete('SET NULL');

      table.string('acao', 120).notNullable();
      table.string('status_anterior', 40).nullable();
      table.string('status_novo', 40).nullable();
      table.text('observacao').nullable();
      table.json('dados').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['venda_id', 'created_at']);
      table.index(['usuario_id', 'created_at']);
    });
  }

  await knex.raw(`
    INSERT INTO venda_historicos (
      venda_id,
      usuario_id,
      acao,
      status_anterior,
      status_novo,
      observacao,
      dados,
      created_at
    )
    SELECT
      v.id,
      v.criado_por_id,
      'venda.criada',
      NULL,
      v.status_funil,
      'Venda cadastrada',
      NULL,
      COALESCE(v.criado_em, v.created_at, NOW())
    FROM vendas v
    WHERE NOT EXISTS (
      SELECT 1
      FROM venda_historicos vh
      WHERE vh.venda_id = v.id
        AND vh.acao = 'venda.criada'
    )
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('venda_historicos');
};
