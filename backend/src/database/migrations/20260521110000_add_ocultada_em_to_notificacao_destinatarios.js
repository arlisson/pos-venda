exports.up = async function (knex) {
  const temOcultadaEm = await knex.schema.hasColumn('notificacao_destinatarios', 'ocultada_em');

  if (!temOcultadaEm) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      table.timestamp('ocultada_em').nullable();
      table.index(['usuario_id', 'ocultada_em'], 'notificacao_dest_ocultada_idx');
    });
  }
};

exports.down = async function (knex) {
  const temOcultadaEm = await knex.schema.hasColumn('notificacao_destinatarios', 'ocultada_em');

  if (temOcultadaEm) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      table.dropIndex(['usuario_id', 'ocultada_em'], 'notificacao_dest_ocultada_idx');
      table.dropColumn('ocultada_em');
    });
  }
};
