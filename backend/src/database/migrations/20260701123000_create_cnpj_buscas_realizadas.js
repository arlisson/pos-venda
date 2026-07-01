exports.up = async function (knex) {
  return knex.schema.createTable('cnpj_buscas_realizadas', function (table) {
    table.increments('id').primary();
    table.string('cnpj', 14).notNullable().unique();
    table.string('razao_social', 255).nullable();
    table.string('nome_fantasia', 255).nullable();
    table.string('email', 255).nullable();
    table.string('telefone', 32).nullable();
    table.string('cep', 16).nullable();
    table.string('endereco', 255).nullable();
    table.string('numero', 32).nullable();
    table.string('complemento', 255).nullable();
    table.string('bairro', 120).nullable();
    table.string('municipio', 120).nullable();
    table.string('uf', 2).nullable();
    table.string('telefone_fonte', 80).nullable();
    table.string('telefone_confianca', 40).nullable();
    table.text('payload').nullable();
    table.timestamp('buscado_em').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['cnpj']);
    table.index(['uf']);
    table.index(['razao_social']);
    table.index(['buscado_em']);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('cnpj_buscas_realizadas');
};
