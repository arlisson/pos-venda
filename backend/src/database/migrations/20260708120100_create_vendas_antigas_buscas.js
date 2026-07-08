exports.up = async function (knex) {
  return knex.schema.createTable('vendas_antigas_buscas', function (table) {
    table.increments('id').primary();
    table.integer('usuario_id').unsigned().nullable().references('id').inTable('usuarios').onDelete('SET NULL');
    table.string('usuario_nome', 160).nullable();
    table.string('cnpj_digitos', 14).notNullable();
    table.string('cnpj_formatado', 18).nullable();
    table.boolean('encontrou').notNullable().defaultTo(false);
    table.timestamp('buscado_em').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['usuario_id']);
    table.index(['buscado_em']);
    table.index(['cnpj_digitos']);
  });
};

exports.down = async function (knex) {
  return knex.schema.dropTableIfExists('vendas_antigas_buscas');
};
