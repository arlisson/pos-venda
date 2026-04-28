/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('metas', table => {
    table.increments('id').primary();
    table.string('tipo').notNullable().unique(); // ex: 'diaria', 'vendas', 'chips', 'port_vivo'
    table.integer('target').notNullable(); // o alvo da meta (ex: 15, 5, 3)
    table.string('desc').notNullable(); // ex: 'Cadastrar 5 clientes'
    table.string('reward').nullable(); // ex: 'Vale iFood R$ 50', pode ser nulo para a meta diária global
    table.boolean('is_gift').notNullable().defaultTo(true); // true para presentes da gamificação, false para a meta diária global
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('metas');
};
