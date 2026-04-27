exports.up = function (knex) {
  return knex.schema.createTable('audit_logs', function (table) {
    table.increments('id').primary();

    table
      .integer('usuario_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table.string('acao', 120).notNullable();
    table.string('entidade', 80).nullable();
    table.string('entidade_id', 80).nullable();
    table.string('metodo', 10).nullable();
    table.string('rota', 255).nullable();
    table.string('ip', 80).nullable();
    table.string('user_agent', 255).nullable();
    table.json('dados').nullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['usuario_id', 'created_at']);
    table.index(['acao', 'created_at']);
    table.index(['entidade', 'entidade_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('audit_logs');
};
