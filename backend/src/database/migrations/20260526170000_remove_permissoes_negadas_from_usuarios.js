exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('usuarios', 'permissoes_negadas');

  if (!hasColumn) return;

  return knex.schema.alterTable('usuarios', function (table) {
    table.dropColumn('permissoes_negadas');
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('usuarios', 'permissoes_negadas');

  if (hasColumn) return;

  return knex.schema.alterTable('usuarios', function (table) {
    table.json('permissoes_negadas').notNullable().defaultTo('[]');
  });
};
