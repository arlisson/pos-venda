exports.up = function(knex) {
  return knex.schema.createTable('meta_resgates', table => {
    table.increments('id').primary();

    table
      .integer('usuario_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table
      .integer('meta_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('metas')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table.string('periodo', 20).notNullable();
    table.date('periodo_inicio').notNullable();
    table.date('periodo_fim').notNullable();
    table.string('reward_snapshot').nullable();
    table.timestamp('claimed_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['usuario_id', 'meta_id', 'periodo_inicio'], 'meta_resgates_usuario_meta_periodo_unique');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('meta_resgates');
};
