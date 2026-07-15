exports.up = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.string('melhor_numero_contato', 20).nullable().after('whatsapp_numero');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.dropColumn('melhor_numero_contato');
  });
};