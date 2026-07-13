exports.up = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.json('chips_itens').nullable().after('quantidade_chips');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.dropColumn('chips_itens');
  });
};
