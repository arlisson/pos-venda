exports.up = async function (knex) {
  return knex.schema.createTable('cnpj_consultas_cache', function (table) {
    table.increments('id').primary();
    table.string('cnpj', 14).notNullable().unique();
    table.text('payload_normalizado').notNullable();
    table.text('payload_bruto_resumido').nullable();
    table.text('fontes').nullable();
    table.timestamp('expira_em').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['cnpj']);
    table.index(['expira_em']);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('cnpj_consultas_cache');
};
