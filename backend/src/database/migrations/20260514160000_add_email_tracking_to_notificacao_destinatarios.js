exports.up = async function (knex) {
  const temEmailEnviadoEm = await knex.schema.hasColumn('notificacao_destinatarios', 'email_enviado_em');
  const temEmailErro = await knex.schema.hasColumn('notificacao_destinatarios', 'email_erro');

  if (!temEmailEnviadoEm || !temEmailErro) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      if (!temEmailEnviadoEm) {
        table.timestamp('email_enviado_em').nullable();
        table.index(['usuario_id', 'email_enviado_em'], 'notificacao_dest_email_enviado_idx');
      }

      if (!temEmailErro) {
        table.text('email_erro').nullable();
      }
    });
  }
};

exports.down = async function (knex) {
  const temEmailEnviadoEm = await knex.schema.hasColumn('notificacao_destinatarios', 'email_enviado_em');
  const temEmailErro = await knex.schema.hasColumn('notificacao_destinatarios', 'email_erro');

  if (temEmailEnviadoEm || temEmailErro) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      if (temEmailEnviadoEm) {
        table.dropIndex(['usuario_id', 'email_enviado_em'], 'notificacao_dest_email_enviado_idx');
        table.dropColumn('email_enviado_em');
      }

      if (temEmailErro) {
        table.dropColumn('email_erro');
      }
    });
  }
};
