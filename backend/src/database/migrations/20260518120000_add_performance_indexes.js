exports.up = async function (knex) {
  const hasIndex = (table, name) =>
    knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${name}'`)
      .then(([rows]) => rows.length > 0);

  const addIndex = async (table, cols, name) => {
    if (!(await hasIndex(table, name))) {
      await knex.schema.alterTable(table, t => t.index(cols, name));
    }
  };

  await addIndex('vendas', ['vendedora_id'], 'idx_vendas_vendedora_id');
  await addIndex('vendas', ['status_funil'], 'idx_vendas_status_funil');
  await addIndex('vendas', ['data_venda'], 'idx_vendas_data_venda');
  await addIndex('vendas', ['operadora_id'], 'idx_vendas_operadora_id');
  await addIndex('vendas', ['tipo_venda_id'], 'idx_vendas_tipo_venda_id');
  await addIndex('vendas', ['servico_id'], 'idx_vendas_servico_id');
  await addIndex('vendas', ['criado_por_id'], 'idx_vendas_criado_por_id');
  await addIndex('vendas', ['cliente_id'], 'idx_vendas_cliente_id');
  await addIndex('vendas', ['excluido_em', 'data_venda', 'id'], 'idx_vendas_excluido_data_id');
  await addIndex('vendas', ['excluido_em', 'status_funil'], 'idx_vendas_excluido_status');

  await addIndex('clientes', ['operadora_atual_id'], 'idx_clientes_operadora_atual_id');
  await addIndex('clientes', ['responsavel_tipo'], 'idx_clientes_responsavel_tipo');
  await addIndex('clientes', ['base_anterior_sistema'], 'idx_clientes_base_anterior_sistema');
  await addIndex('clientes', ['quantidade_chips'], 'idx_clientes_quantidade_chips');
  await addIndex('clientes', ['fidelidade_fim'], 'idx_clientes_fidelidade_fim');
  await addIndex('clientes', ['criado_por_id'], 'idx_clientes_criado_por_id');
  await addIndex('clientes', ['excluido_em', 'nome'], 'idx_clientes_excluido_nome');

  await addIndex('entidade_notas', ['entidade_tipo', 'entidade_id', 'usuario_id'], 'idx_notas_entidade_usuario');
  await addIndex('entidade_notas', ['retorno_agendado_para'], 'idx_notas_retorno_agendado_para');
  await addIndex('entidade_notas', ['entidade_tipo', 'usuario_id', 'retorno_agendado_para'], 'idx_notas_tipo_usuario_retorno');
};

exports.down = async function (knex) {
  const dropIfExists = async (table, name) => {
    const [rows] = await knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${name}'`);
    if (rows.length > 0) {
      await knex.schema.alterTable(table, t => t.dropIndex([], name));
    }
  };

  await dropIfExists('vendas', 'idx_vendas_vendedora_id');
  await dropIfExists('vendas', 'idx_vendas_status_funil');
  await dropIfExists('vendas', 'idx_vendas_data_venda');
  await dropIfExists('vendas', 'idx_vendas_operadora_id');
  await dropIfExists('vendas', 'idx_vendas_tipo_venda_id');
  await dropIfExists('vendas', 'idx_vendas_servico_id');
  await dropIfExists('vendas', 'idx_vendas_criado_por_id');
  await dropIfExists('vendas', 'idx_vendas_cliente_id');
  await dropIfExists('vendas', 'idx_vendas_excluido_data_id');
  await dropIfExists('vendas', 'idx_vendas_excluido_status');

  await dropIfExists('clientes', 'idx_clientes_operadora_atual_id');
  await dropIfExists('clientes', 'idx_clientes_responsavel_tipo');
  await dropIfExists('clientes', 'idx_clientes_base_anterior_sistema');
  await dropIfExists('clientes', 'idx_clientes_quantidade_chips');
  await dropIfExists('clientes', 'idx_clientes_fidelidade_fim');
  await dropIfExists('clientes', 'idx_clientes_criado_por_id');
  await dropIfExists('clientes', 'idx_clientes_excluido_nome');

  await dropIfExists('entidade_notas', 'idx_notas_entidade_usuario');
  await dropIfExists('entidade_notas', 'idx_notas_retorno_agendado_para');
  await dropIfExists('entidade_notas', 'idx_notas_tipo_usuario_retorno');
};
