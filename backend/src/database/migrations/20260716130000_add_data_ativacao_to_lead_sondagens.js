exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('lead_sondagens', 'data_ativacao');
  if (!existe) {
    await knex.schema.table('lead_sondagens', table => {
      table.date('data_ativacao').nullable().after('terminal');
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('lead_sondagens', 'data_ativacao');
  if (existe) {
    await knex.schema.table('lead_sondagens', table => {
      table.dropColumn('data_ativacao');
    });
  }
};