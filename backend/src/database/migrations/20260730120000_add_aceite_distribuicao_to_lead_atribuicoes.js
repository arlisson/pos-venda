exports.up = async function (knex) {
  await knex.schema.table('lead_atribuicoes', table => {
    table.string('aceite_status', 32).nullable().after('status');
    table.timestamp('aceite_em').nullable().after('aceite_status');
    table.timestamp('recusado_em').nullable().after('aceite_em');
    table.timestamp('prazo_acao_em').nullable().after('recusado_em');
    table.timestamp('acao_registrada_em').nullable().after('prazo_acao_em');
    table.string('acao_registrada_tipo', 64).nullable().after('acao_registrada_em');
    table.string('cancelamento_motivo', 255).nullable().after('acao_registrada_tipo');
    table.string('telegram_chat_id', 64).nullable().after('cancelamento_motivo');
    table.string('telegram_message_id', 64).nullable().after('telegram_chat_id');
    table.text('telegram_mensagem_texto').nullable().after('telegram_message_id');
    table.string('gerente_telegram_id', 64).nullable().after('telegram_mensagem_texto');

    table.index(
      ['etapa', 'aceite_status', 'prazo_acao_em'],
      'lead_atribuicoes_aceite_prazo_idx'
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_atribuicoes', table => {
    table.dropIndex(
      ['etapa', 'aceite_status', 'prazo_acao_em'],
      'lead_atribuicoes_aceite_prazo_idx'
    );
    table.dropColumn('gerente_telegram_id');
    table.dropColumn('telegram_mensagem_texto');
    table.dropColumn('telegram_message_id');
    table.dropColumn('telegram_chat_id');
    table.dropColumn('cancelamento_motivo');
    table.dropColumn('acao_registrada_tipo');
    table.dropColumn('acao_registrada_em');
    table.dropColumn('prazo_acao_em');
    table.dropColumn('recusado_em');
    table.dropColumn('aceite_em');
    table.dropColumn('aceite_status');
  });
};
