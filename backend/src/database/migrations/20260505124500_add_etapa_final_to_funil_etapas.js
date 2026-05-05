exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('funil_etapas', 'etapa_final');

  if (!existe) {
    await knex.schema.alterTable('funil_etapas', function (table) {
      table.boolean('etapa_final').notNullable().defaultTo(false);
    });
  }

  await knex('funil_etapas')
    .where('codigo', 'concluido')
    .update({ etapa_final: true });
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('funil_etapas', 'etapa_final');

  if (existe) {
    await knex.schema.alterTable('funil_etapas', function (table) {
      table.dropColumn('etapa_final');
    });
  }
};
