async function hasIndex(knex, tableName, indexName) {
  const rows = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [tableName, indexName]);
  const result = Array.isArray(rows) ? rows[0] : rows;
  return Array.isArray(result) && result.length > 0;
}

async function addColumnIfMissing(knex, tableName, columnName, addColumn) {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (exists) return;

  await knex.schema.alterTable(tableName, function (table) {
    addColumn(table);
  });
}

async function dropColumnIfExists(knex, tableName, columnName) {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (!exists) return;

  await knex.schema.alterTable(tableName, function (table) {
    table.dropColumn(columnName);
  });
}

exports.up = async function (knex) {
  await addColumnIfMissing(knex, 'lead_planilhas', 'status', table => {
    table.string('status', 40).notNullable().defaultTo('concluida');
  });
  await addColumnIfMissing(knex, 'lead_planilhas', 'progresso_percentual', table => {
    table.integer('progresso_percentual').unsigned().notNullable().defaultTo(100);
  });
  await addColumnIfMissing(knex, 'lead_planilhas', 'linhas_processadas', table => {
    table.integer('linhas_processadas').unsigned().notNullable().defaultTo(0);
  });
  await addColumnIfMissing(knex, 'lead_planilhas', 'erro_processamento', table => {
    table.text('erro_processamento').nullable();
  });
  await addColumnIfMissing(knex, 'lead_planilhas', 'arquivo_temporario', table => {
    table.string('arquivo_temporario', 500).nullable();
  });
  await addColumnIfMissing(knex, 'lead_planilhas', 'tamanho_bytes', table => {
    table.bigInteger('tamanho_bytes').unsigned().notNullable().defaultTo(0);
  });

  if (!(await hasIndex(knex, 'lead_planilhas', 'lead_planilhas_status_index'))) {
    await knex.schema.alterTable('lead_planilhas', function (table) {
      table.index(['status'], 'lead_planilhas_status_index');
    });
  }

  if (!(await hasIndex(knex, 'lead_linhas', 'lead_linhas_planilha_row_idx'))) {
    await knex.schema.alterTable('lead_linhas', function (table) {
      table.index(['planilha_id', 'row_index'], 'lead_linhas_planilha_row_idx');
    });
  }

  if (!(await hasIndex(knex, 'lead_linhas', 'lead_linhas_envio_usuario_idx'))) {
    await knex.schema.alterTable('lead_linhas', function (table) {
      table.index(['envio_id', 'atribuido_para_id'], 'lead_linhas_envio_usuario_idx');
    });
  }
};

exports.down = async function (knex) {
  if (await hasIndex(knex, 'lead_linhas', 'lead_linhas_envio_usuario_idx')) {
    await knex.schema.alterTable('lead_linhas', function (table) {
      table.dropIndex(['envio_id', 'atribuido_para_id'], 'lead_linhas_envio_usuario_idx');
    });
  }

  if (await hasIndex(knex, 'lead_linhas', 'lead_linhas_planilha_row_idx')) {
    await knex.schema.alterTable('lead_linhas', function (table) {
      table.dropIndex(['planilha_id', 'row_index'], 'lead_linhas_planilha_row_idx');
    });
  }

  if (await hasIndex(knex, 'lead_planilhas', 'lead_planilhas_status_index')) {
    await knex.schema.alterTable('lead_planilhas', function (table) {
      table.dropIndex(['status'], 'lead_planilhas_status_index');
    });
  }

  await dropColumnIfExists(knex, 'lead_planilhas', 'tamanho_bytes');
  await dropColumnIfExists(knex, 'lead_planilhas', 'arquivo_temporario');
  await dropColumnIfExists(knex, 'lead_planilhas', 'erro_processamento');
  await dropColumnIfExists(knex, 'lead_planilhas', 'linhas_processadas');
  await dropColumnIfExists(knex, 'lead_planilhas', 'progresso_percentual');
  await dropColumnIfExists(knex, 'lead_planilhas', 'status');
};

exports.config = {
  transaction: false
};
