exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    // Contato RL
    table.string('email_representante_legal', 160).nullable();
    table.string('telefone_representante_legal', 40).nullable();
    // Contato ADM
    table.string('email_administrador', 160).nullable();
    table.string('telefone_administrador', 40).nullable();
    // Aceite — range de horário
    table.string('horario_aceite_inicio', 10).nullable();
    table.string('horario_aceite_fim', 10).nullable();
    // Aceite — range de dia
    table.string('dia_aceite_inicio', 20).nullable();
    table.string('dia_aceite_fim', 20).nullable();
    // Credenciais e protocolo
    table.string('protocolo', 120).nullable();
    table.string('login', 120).nullable();
    table.string('senha', 255).nullable();
    // Responsáveis 2 e 3
    table.string('responsavel_recebimento_2', 240).nullable();
    table.string('rg_responsavel_recebimento_2', 40).nullable();
    table.string('responsavel_recebimento_3', 240).nullable();
    table.string('rg_responsavel_recebimento_3', 40).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('email_representante_legal');
    table.dropColumn('telefone_representante_legal');
    table.dropColumn('email_administrador');
    table.dropColumn('telefone_administrador');
    table.dropColumn('horario_aceite_inicio');
    table.dropColumn('horario_aceite_fim');
    table.dropColumn('dia_aceite_inicio');
    table.dropColumn('dia_aceite_fim');
    table.dropColumn('protocolo');
    table.dropColumn('login');
    table.dropColumn('senha');
    table.dropColumn('responsavel_recebimento_2');
    table.dropColumn('rg_responsavel_recebimento_2');
    table.dropColumn('responsavel_recebimento_3');
    table.dropColumn('rg_responsavel_recebimento_3');
  });
};
