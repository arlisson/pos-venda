exports.up = async function (knex) {
  await knex.schema.createTable('lead_atribuicoes', table => {
    table.increments('id').primary();
    table.integer('lead_linha_id').unsigned().notNullable().references('id').inTable('lead_linhas').onUpdate('CASCADE').onDelete('CASCADE');
    table.integer('envio_id').unsigned().nullable().references('id').inTable('lead_envios').onUpdate('CASCADE').onDelete('SET NULL');
    table.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('CASCADE');
    table.enu('etapa', ['sondagem', 'venda']).notNullable().defaultTo('sondagem');
    table.enu('status', ['atribuido', 'qualificado', 'nao_qualificado', 'sem_contato', 'invalido', 'vendido', 'perdido']).notNullable().defaultTo('atribuido');
    table.string('motivo_resultado', 255).nullable();
    table.timestamp('atribuido_em').defaultTo(knex.fn.now());
    table.timestamp('finalizado_em').nullable();
    table.integer('criado_por_id').unsigned().nullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL');
    table.timestamps(true, true);
    table.index(['lead_linha_id', 'etapa'], 'lead_atribuicoes_linha_etapa_idx');
    table.index(['usuario_id', 'etapa', 'status'], 'lead_atribuicoes_usuario_etapa_status_idx');
  });

  await knex.schema.createTable('lead_sondagens', table => {
    table.increments('id').primary();
    table.integer('lead_linha_id').unsigned().notNullable().references('id').inTable('lead_linhas').onUpdate('CASCADE').onDelete('CASCADE');
    table.integer('atribuicao_id').unsigned().nullable().references('id').inTable('lead_atribuicoes').onUpdate('CASCADE').onDelete('SET NULL');
    table.integer('usuario_id').unsigned().notNullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('CASCADE');
    table.string('contato_nome', 240).notNullable();
    table.enu('contato_tipo', ['adm', 'rl']).notNullable();
    table.integer('operadora_atual_id').unsigned().notNullable().references('id').inTable('operadoras').onUpdate('CASCADE').onDelete('RESTRICT');
    table.integer('quantidade_chips').unsigned().notNullable();
    table.decimal('preco_por_chip', 12, 2).notNullable();
    table.decimal('valor_mensal_estimado', 14, 2).notNullable();
    table.string('whatsapp_ddd', 4).notNullable();
    table.string('whatsapp_numero', 20).notNullable();
    table.text('observacoes').nullable();
    table.datetime('retorno_em').nullable();
    table.timestamp('respondido_em').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.unique(['lead_linha_id']);
    table.index(['usuario_id', 'respondido_em'], 'lead_sondagens_usuario_data_idx');
    table.index(['operadora_atual_id'], 'lead_sondagens_operadora_idx');
  });

  await knex.schema.table('lead_linhas', table => {
    table.enu('etapa_atual', ['sondagem', 'venda']).notNullable().defaultTo('sondagem');
    table.enu('status_operacional', ['pendente', 'qualificado', 'distribuido_venda', 'vendido', 'perdido']).notNullable().defaultTo('pendente');
    table.integer('cliente_id').unsigned().nullable().references('id').inTable('clientes').onUpdate('CASCADE').onDelete('SET NULL');
    table.integer('venda_id').unsigned().nullable().references('id').inTable('vendas').onUpdate('CASCADE').onDelete('SET NULL');
    table.index(['etapa_atual', 'status_operacional'], 'lead_linhas_etapa_status_idx');
    table.index(['cliente_id'], 'lead_linhas_cliente_idx');
    table.index(['venda_id'], 'lead_linhas_venda_idx');
  });

  await knex('lead_linhas')
    .where('futuro_cliente', true)
    .update({ status_operacional: 'qualificado' });

  await knex.raw(`
    INSERT INTO lead_atribuicoes
      (lead_linha_id, envio_id, usuario_id, etapa, status, atribuido_em, finalizado_em, criado_por_id, created_at, updated_at)
    SELECT id, envio_id, atribuido_para_id, 'sondagem',
      CASE WHEN futuro_cliente = 1 THEN 'qualificado' ELSE 'atribuido' END,
      COALESCE(created_at, CURRENT_TIMESTAMP),
      CASE WHEN futuro_cliente = 1 THEN futuro_cliente_marcado_em ELSE NULL END,
      atribuido_para_id, COALESCE(created_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
    FROM lead_linhas
    WHERE atribuido_para_id IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.table('lead_linhas', table => {
    table.dropIndex(['venda_id'], 'lead_linhas_venda_idx');
    table.dropIndex(['cliente_id'], 'lead_linhas_cliente_idx');
    table.dropIndex(['etapa_atual', 'status_operacional'], 'lead_linhas_etapa_status_idx');
    table.dropColumn('venda_id');
    table.dropColumn('cliente_id');
    table.dropColumn('status_operacional');
    table.dropColumn('etapa_atual');
  });
  await knex.schema.dropTableIfExists('lead_sondagens');
  await knex.schema.dropTableIfExists('lead_atribuicoes');
};
