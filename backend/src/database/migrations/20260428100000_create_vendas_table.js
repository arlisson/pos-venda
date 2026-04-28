exports.up = function (knex) {
  return knex.schema.createTable('vendas', function (table) {
    table.increments('id').primary();

    table.string('nome', 240).notNullable();
    table.string('telefone', 40).nullable();
    table.string('email', 160).nullable();
    table.string('email_2', 160).nullable();
    table.timestamp('criado_em').nullable();
    table.timestamp('ultima_atividade_em').nullable();

    table.string('nome_responsavel', 240).nullable();
    table.string('fixo_ddd', 40).nullable();
    table.string('nome_fechou_venda', 240).nullable();
    table.string('cpf_responsavel', 20).nullable();
    table.string('setor_funcao', 120).nullable();
    table.string('produto_fechado', 160).nullable();
    table.integer('quantidade_linhas').unsigned().nullable();
    table.string('ddd', 10).nullable();
    table.text('numeros_portados').nullable();
    table.decimal('valor_total', 12, 2).nullable();
    table.string('ponto_referencia', 255).nullable();
    table.string('tipo_local_cpf', 160).nullable();
    table.string('razao_social', 240).nullable();
    table.string('cnpj', 20).nullable();
    table.date('data_venda').nullable();
    table.string('qc_feito_por', 120).nullable();
    table.text('observacoes').nullable();

    table
      .integer('vendedora_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('RESTRICT');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('vendas');
};
