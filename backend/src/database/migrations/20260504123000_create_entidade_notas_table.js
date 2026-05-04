exports.up = async function (knex) {
  return knex.schema.createTable('entidade_notas', function (table) {
    table.increments('id').primary();
    table.string('entidade_tipo', 20).notNullable();
    table.integer('entidade_id').unsigned().notNullable();
    table
      .integer('usuario_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.string('titulo', 160).nullable();
    table.text('conteudo').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['entidade_tipo', 'entidade_id', 'usuario_id'], 'entidade_notas_lookup_idx');
    table.index(['usuario_id', 'updated_at'], 'entidade_notas_usuario_updated_idx');
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('entidade_notas');
};
