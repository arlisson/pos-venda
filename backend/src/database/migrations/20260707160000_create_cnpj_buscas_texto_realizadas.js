exports.up = function (knex) {
  return knex.schema.createTable('cnpj_buscas_texto_realizadas', function (table) {
    table.increments('id').primary();
    table.string('chave', 255).notNullable().unique();
    table.string('termo_busca', 255).notNullable();
    table.string('cnpj', 14).nullable();
    table.string('razao_social', 255).nullable();
    table.string('nome_fantasia', 255).nullable();
    table.string('email', 255).nullable();
    table.string('telefone', 50).nullable();
    table.string('telefone_fonte', 80).nullable();
    table.string('telefone_confianca', 40).nullable();
    table.string('google_place_id', 255).nullable();
    table.string('google_detalhe', 500).nullable();
    table.text('payload').nullable();
    table.timestamp('buscado_em').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.index(['termo_busca']);
    table.index(['cnpj']);
    table.index(['buscado_em']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cnpj_buscas_texto_realizadas');
};
