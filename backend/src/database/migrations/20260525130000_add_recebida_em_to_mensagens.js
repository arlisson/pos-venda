exports.up = async function (knex) {
  const existe = await knex.schema.hasColumn('mensagens', 'recebida_em');

  if (!existe) {
    await knex.schema.alterTable('mensagens', function (table) {
      table.timestamp('recebida_em').nullable();
      table.index(['destinatario_id', 'recebida_em']);
    });
  }
};

exports.down = async function (knex) {
  const existe = await knex.schema.hasColumn('mensagens', 'recebida_em');

  if (existe) {
    await knex.schema.alterTable('mensagens', function (table) {
      table.dropIndex(['destinatario_id', 'recebida_em']);
      table.dropColumn('recebida_em');
    });
  }
};
