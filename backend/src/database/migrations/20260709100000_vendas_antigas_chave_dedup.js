/**
 * Permite guardar vendas antigas sem CNPJ valido (CPF, documento truncado ou
 * ausente), trocando a chave de deduplicacao de `cnpj_digitos` para `chave_dedup`.
 *
 * ATENCAO: o `down` e destrutivo. Linhas importadas sem CNPJ (cnpj_digitos NULL)
 * sao apagadas para que a coluna possa voltar a ser NOT NULL.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.string('documento_digitos', 14).nullable();
    table.string('documento_tipo', 12).nullable();
    // 191 e o limite de indice unico em utf8mb4 no MySQL.
    table.string('chave_dedup', 191).nullable();
  });

  await knex('vendas_antigas').update({
    chave_dedup: knex.raw("concat('cnpj:', cnpj_digitos)"),
    documento_digitos: knex.ref('cnpj_digitos'),
    documento_tipo: 'cnpj'
  });

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.string('chave_dedup', 191).notNullable().alter();
    table.unique(['chave_dedup']);

    table.dropUnique(['cnpj_digitos']);
    table.string('cnpj_digitos', 14).nullable().alter();

    table.index(['documento_digitos']);
    table.index(['nome_fantasia']);
  });
};

exports.down = async function (knex) {
  await knex('vendas_antigas').whereNull('cnpj_digitos').del();

  await knex.schema.alterTable('vendas_antigas', function (table) {
    table.dropIndex(['nome_fantasia']);
    table.dropIndex(['documento_digitos']);
    table.dropUnique(['chave_dedup']);

    table.string('cnpj_digitos', 14).notNullable().alter();
    table.unique(['cnpj_digitos']);

    table.dropColumn('chave_dedup');
    table.dropColumn('documento_tipo');
    table.dropColumn('documento_digitos');
  });
};
