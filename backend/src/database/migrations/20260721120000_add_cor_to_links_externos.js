exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('links_externos', 'cor');
  if (!existe) {
    await knex.schema.alterTable('links_externos', function (table) {
      table.string('cor', 7).nullable().after('dot');
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('links_externos', 'cor');
  if (existe) {
    await knex.schema.alterTable('links_externos', function (table) {
      table.dropColumn('cor');
    });
  }
};