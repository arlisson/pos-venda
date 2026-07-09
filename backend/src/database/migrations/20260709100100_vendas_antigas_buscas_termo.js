/**
 * Permite registrar no historico buscas feitas por razao social, alem de CNPJ/CPF.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('vendas_antigas_buscas', function (table) {
    table.string('termo', 255).nullable();
    table.string('tipo_busca', 12).notNullable().defaultTo('cnpj');
  });

  await knex('vendas_antigas_buscas').update({
    termo: knex.ref('cnpj_formatado')
  });

  await knex.schema.alterTable('vendas_antigas_buscas', function (table) {
    table.string('cnpj_digitos', 14).nullable().alter();
  });
};

exports.down = async function (knex) {
  await knex('vendas_antigas_buscas').whereNull('cnpj_digitos').del();

  await knex.schema.alterTable('vendas_antigas_buscas', function (table) {
    table.string('cnpj_digitos', 14).notNullable().alter();
    table.dropColumn('tipo_busca');
    table.dropColumn('termo');
  });
};
