async function addColumnIfMissing(knex, tableName, columnName, addColumn) {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (!exists) {
    await knex.schema.table(tableName, table => addColumn(table));
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (exists) {
    await knex.schema.table(tableName, table => table.dropColumn(columnName));
  }
}

exports.up = async function (knex) {
  await addColumnIfMissing(knex, 'clientes_secretos', 'telefone_receita', table => {
    table.string('telefone_receita', 32).nullable().after('fixo_numero');
  });
  await addColumnIfMissing(knex, 'clientes_secretos', 'telefone_receita_contatavel', table => {
    table.boolean('telefone_receita_contatavel').notNullable().defaultTo(false).after('telefone_receita');
  });
  await addColumnIfMissing(knex, 'clientes_secretos', 'telefone_google', table => {
    table.string('telefone_google', 32).nullable().after('telefone_receita_contatavel');
  });
  await addColumnIfMissing(knex, 'clientes_secretos', 'telefone_google_contatavel', table => {
    table.boolean('telefone_google_contatavel').notNullable().defaultTo(false).after('telefone_google');
  });
};

exports.down = async function (knex) {
  await dropColumnIfExists(knex, 'clientes_secretos', 'telefone_google_contatavel');
  await dropColumnIfExists(knex, 'clientes_secretos', 'telefone_google');
  await dropColumnIfExists(knex, 'clientes_secretos', 'telefone_receita_contatavel');
  await dropColumnIfExists(knex, 'clientes_secretos', 'telefone_receita');
};