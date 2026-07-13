exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('funil_etapas', 'bloqueia_avanco');

  if (!existe) {
    await knex.schema.alterTable('funil_etapas', function (table) {
      table.boolean('bloqueia_avanco').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('funil_etapas', 'bloqueia_avanco');

  if (existe) {
    await knex.schema.alterTable('funil_etapas', function (table) {
      table.dropColumn('bloqueia_avanco');
    });
  }
};
