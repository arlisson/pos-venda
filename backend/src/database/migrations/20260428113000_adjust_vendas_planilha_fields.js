exports.up = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.renameColumn('nome_responsavel', 'nome_representante_legal');
    table.renameColumn('cpf_responsavel', 'cpf_representante_legal');
  });

  return knex.schema.alterTable('vendas', function (table) {
    table.string('gb', 40).nullable();
    table.text('valores_unitarios_chips').nullable();
    table.integer('dia_vencimento').unsigned().nullable();
    table.string('endereco', 255).nullable();
    table.string('numero_endereco', 30).nullable();
    table.string('complemento', 160).nullable();
    table.string('bairro', 120).nullable();
    table.string('municipio', 120).nullable();
    table.string('uf', 2).nullable();
    table.string('cep', 20).nullable();
    table.string('horario_aceite_voz', 120).nullable();
    table.string('responsavel_recebimento', 240).nullable();
    table.string('rg_responsavel_recebimento', 40).nullable();
    table.string('nome_administrador', 240).nullable();
    table.string('cpf_administrador', 40).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropColumn('gb');
    table.dropColumn('valores_unitarios_chips');
    table.dropColumn('dia_vencimento');
    table.dropColumn('endereco');
    table.dropColumn('numero_endereco');
    table.dropColumn('complemento');
    table.dropColumn('bairro');
    table.dropColumn('municipio');
    table.dropColumn('uf');
    table.dropColumn('cep');
    table.dropColumn('horario_aceite_voz');
    table.dropColumn('responsavel_recebimento');
    table.dropColumn('rg_responsavel_recebimento');
    table.dropColumn('nome_administrador');
    table.dropColumn('cpf_administrador');
  });

  return knex.schema.alterTable('vendas', function (table) {
    table.renameColumn('nome_representante_legal', 'nome_responsavel');
    table.renameColumn('cpf_representante_legal', 'cpf_responsavel');
  });
};
