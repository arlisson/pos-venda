exports.up = async function (knex) {
  return knex.schema.createTable('cnpj_google_places_keys', function (table) {
    table.increments('id').primary();
    table.string('nome', 120).notNullable();
    table.text('api_key').notNullable();
    table.boolean('ativo').notNullable().defaultTo(true);
    table.timestamp('esgotada_em').nullable();
    table.timestamp('esgotada_ate').nullable();
    table.string('ultimo_status', 80).nullable();
    table.text('ultimo_erro').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['ativo']);
    table.index(['esgotada_ate']);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('cnpj_google_places_keys');
};
