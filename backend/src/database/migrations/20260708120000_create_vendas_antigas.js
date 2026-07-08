exports.up = async function (knex) {
  return knex.schema.createTable('vendas_antigas', function (table) {
    table.increments('id').primary();
    table.string('cnpj', 18).nullable();
    table.string('cnpj_digitos', 14).notNullable().unique();
    table.string('razao_social', 255).nullable();
    table.string('nome_fantasia', 255).nullable();
    table.date('data_venda').nullable();
    table.text('dados_extras').nullable();
    table.string('lote', 120).nullable();
    table.integer('importado_por_id').unsigned().nullable().references('id').inTable('usuarios').onDelete('SET NULL');
    table.timestamp('importado_em').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['cnpj_digitos']);
    table.index(['razao_social']);
    table.index(['lote']);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('vendas_antigas');
};
