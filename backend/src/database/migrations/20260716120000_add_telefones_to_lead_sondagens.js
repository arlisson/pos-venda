exports.up = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.string('telefone_fixo', 20).nullable().after('melhor_numero_contato');
    table.string('terminal', 20).nullable().after('telefone_fixo');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.dropColumn('terminal');
    table.dropColumn('telefone_fixo');
  });
};