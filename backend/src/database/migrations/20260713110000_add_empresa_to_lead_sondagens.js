exports.up = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.string('razao_social', 240).nullable().after('usuario_id');
    table.string('cnpj', 20).nullable().after('razao_social');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.dropColumn('cnpj');
    table.dropColumn('razao_social');
  });
};