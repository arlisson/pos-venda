exports.up = async function (knex) {
  // Mensagem só com anexo: conteúdo passa a ser opcional.
  await knex.schema.alterTable('mensagens', table => {
    table.text('conteudo').nullable().alter();
  });

  const existe = await knex.schema.hasTable('mensagem_arquivos');
  if (existe) return;

  await knex.schema.createTable('mensagem_arquivos', table => {
    table.increments('id').primary();
    table.integer('mensagem_id').unsigned().notNullable();
    table.integer('arquivo_id').unsigned().notNullable();
    table.string('nome_original', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.foreign('mensagem_id').references('id').inTable('mensagens').onDelete('CASCADE');
    table.foreign('arquivo_id').references('id').inTable('arquivos').onDelete('RESTRICT');
    table.index(['mensagem_id']);
    table.index(['arquivo_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('mensagem_arquivos');
  await knex.schema.alterTable('mensagens', table => {
    table.text('conteudo').notNullable().alter();
  });
};
