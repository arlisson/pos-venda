exports.up = async function (knex) {
  await knex.schema.alterTable('mensagens', table => {
    table.dateTime('excluido_em').nullable();
    table.boolean('tinha_anexo').notNullable().defaultTo(false);
  });

  // Backfill: marca tinha_anexo nas mensagens já existentes com vínculo.
  await knex.raw(`
    UPDATE mensagens m
    SET tinha_anexo = 1
    WHERE EXISTS (SELECT 1 FROM mensagem_arquivos ma WHERE ma.mensagem_id = m.id)
  `);
};

exports.down = async function (knex) {
  await knex.schema.alterTable('mensagens', table => {
    table.dropColumn('excluido_em');
    table.dropColumn('tinha_anexo');
  });
};
