exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.boolean('endereco_real_divergente').notNullable().defaultTo(false);
    table.string('cep_real', 20).nullable();
    table.string('endereco_real', 255).nullable();
    table.string('numero_endereco_real', 30).nullable();
    table.string('complemento_real', 160).nullable();
    table.string('bairro_real', 120).nullable();
    table.string('municipio_real', 120).nullable();
    table.string('uf_real', 2).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('uf_real');
    table.dropColumn('municipio_real');
    table.dropColumn('bairro_real');
    table.dropColumn('complemento_real');
    table.dropColumn('numero_endereco_real');
    table.dropColumn('endereco_real');
    table.dropColumn('cep_real');
    table.dropColumn('endereco_real_divergente');
  });
};
