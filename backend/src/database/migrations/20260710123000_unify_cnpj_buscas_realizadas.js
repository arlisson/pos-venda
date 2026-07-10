async function hasTable(knex, tableName) {
  return knex.schema.hasTable(tableName);
}

async function hasColumn(knex, tableName, columnName) {
  if (!await hasTable(knex, tableName)) return false;
  return knex.schema.hasColumn(tableName, columnName);
}

async function addColumnIfMissing(knex, tableName, columnName, addColumn) {
  if (!await hasColumn(knex, tableName, columnName)) {
    await knex.schema.alterTable(tableName, addColumn);
  }
}

async function dropColumnIfExists(knex, tableName, columnName) {
  if (await hasColumn(knex, tableName, columnName)) {
    await knex.schema.alterTable(tableName, table => table.dropColumn(columnName));
  }
}

async function dropUniqueIfExists(knex, tableName, columns) {
  try {
    await knex.schema.alterTable(tableName, table => table.dropUnique(columns));
  } catch (error) {
    // Bancos ja migrados manualmente podem nao ter o indice unico original.
  }
}

async function addUniqueIfMissing(knex, tableName, columns, indexName) {
  try {
    await knex.schema.alterTable(tableName, table => table.unique(columns, indexName));
  } catch (error) {
    if (error?.code === 'ER_DUP_KEYNAME') return;
    throw error;
  }
}

exports.up = async function (knex) {
  const tabelaHistorico = 'cnpj_buscas_realizadas';
  const tabelaTexto = 'cnpj_buscas_texto_realizadas';

  if (!await hasTable(knex, tabelaHistorico)) return;

  await addColumnIfMissing(knex, tabelaHistorico, 'chave', table => {
    table.string('chave', 255).nullable().after('id');
  });
  await addColumnIfMissing(knex, tabelaHistorico, 'tipo_busca', table => {
    table.string('tipo_busca', 20).notNullable().defaultTo('cnpj').after('chave');
  });
  await addColumnIfMissing(knex, tabelaHistorico, 'termo_busca', table => {
    table.string('termo_busca', 255).nullable().after('tipo_busca');
  });
  await addColumnIfMissing(knex, tabelaHistorico, 'google_place_id', table => {
    table.string('google_place_id', 255).nullable().after('telefone_confianca');
  });
  await addColumnIfMissing(knex, tabelaHistorico, 'google_detalhe', table => {
    table.string('google_detalhe', 500).nullable().after('google_place_id');
  });

  await dropUniqueIfExists(knex, tabelaHistorico, ['cnpj']);
  await knex.schema.alterTable(tabelaHistorico, table => {
    table.string('cnpj', 14).nullable().alter();
  });

  await knex(tabelaHistorico)
    .where(function () {
      this.whereNull('tipo_busca').orWhere('tipo_busca', '');
    })
    .update({ tipo_busca: 'cnpj' });

  await knex.raw(`
    UPDATE ??
       SET chave = CONCAT('cnpj:', cnpj),
           tipo_busca = 'cnpj',
           termo_busca = COALESCE(termo_busca, razao_social, nome_fantasia, cnpj)
     WHERE (chave IS NULL OR chave = '')
       AND cnpj IS NOT NULL
       AND cnpj <> ''
  `, [tabelaHistorico]);

  await addUniqueIfMissing(knex, tabelaHistorico, ['chave'], 'cnpj_buscas_realizadas_chave_unique');

  if (await hasTable(knex, tabelaTexto)) {
    await knex.raw(`
      INSERT INTO ?? (
        chave, tipo_busca, termo_busca, cnpj, razao_social, nome_fantasia, email, telefone,
        telefone_fonte, telefone_confianca, google_place_id, google_detalhe, payload,
        buscado_em, created_at, updated_at
      )
      SELECT
        chave, 'texto', termo_busca, cnpj, razao_social, nome_fantasia, email, telefone,
        telefone_fonte, telefone_confianca, google_place_id, google_detalhe, payload,
        buscado_em, created_at, updated_at
      FROM ??
      ON DUPLICATE KEY UPDATE
        tipo_busca = VALUES(tipo_busca),
        termo_busca = VALUES(termo_busca),
        cnpj = VALUES(cnpj),
        razao_social = VALUES(razao_social),
        nome_fantasia = VALUES(nome_fantasia),
        email = VALUES(email),
        telefone = VALUES(telefone),
        telefone_fonte = VALUES(telefone_fonte),
        telefone_confianca = VALUES(telefone_confianca),
        google_place_id = VALUES(google_place_id),
        google_detalhe = VALUES(google_detalhe),
        payload = VALUES(payload),
        buscado_em = VALUES(buscado_em),
        updated_at = VALUES(updated_at)
    `, [tabelaHistorico, tabelaTexto]);

    await knex.schema.dropTable(tabelaTexto);
  }

  await knex.schema.alterTable(tabelaHistorico, table => {
    table.string('chave', 255).notNullable().alter();
  });
};

exports.down = async function (knex) {
  const tabelaHistorico = 'cnpj_buscas_realizadas';
  const tabelaTexto = 'cnpj_buscas_texto_realizadas';

  if (!await hasTable(knex, tabelaHistorico)) return;

  if (!await hasTable(knex, tabelaTexto)) {
    await knex.schema.createTable(tabelaTexto, function (table) {
      table.increments('id').primary();
      table.string('chave', 255).notNullable().unique();
      table.string('termo_busca', 255).notNullable();
      table.string('cnpj', 14).nullable();
      table.string('razao_social', 255).nullable();
      table.string('nome_fantasia', 255).nullable();
      table.string('email', 255).nullable();
      table.string('telefone', 50).nullable();
      table.string('telefone_fonte', 80).nullable();
      table.string('telefone_confianca', 40).nullable();
      table.string('google_place_id', 255).nullable();
      table.string('google_detalhe', 500).nullable();
      table.text('payload').nullable();
      table.timestamp('buscado_em').notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['termo_busca']);
      table.index(['cnpj']);
      table.index(['buscado_em']);
    });
  }

  if (await hasColumn(knex, tabelaHistorico, 'tipo_busca')) {
    await knex.raw(`
      INSERT INTO ?? (
        chave, termo_busca, cnpj, razao_social, nome_fantasia, email, telefone,
        telefone_fonte, telefone_confianca, google_place_id, google_detalhe, payload,
        buscado_em, created_at, updated_at
      )
      SELECT
        chave, COALESCE(termo_busca, razao_social, nome_fantasia, 'Busca por texto'), cnpj,
        razao_social, nome_fantasia, email, telefone, telefone_fonte, telefone_confianca,
        google_place_id, google_detalhe, payload, buscado_em, created_at, updated_at
      FROM ??
      WHERE tipo_busca = 'texto'
      ON DUPLICATE KEY UPDATE
        termo_busca = VALUES(termo_busca),
        cnpj = VALUES(cnpj),
        razao_social = VALUES(razao_social),
        nome_fantasia = VALUES(nome_fantasia),
        email = VALUES(email),
        telefone = VALUES(telefone),
        telefone_fonte = VALUES(telefone_fonte),
        telefone_confianca = VALUES(telefone_confianca),
        google_place_id = VALUES(google_place_id),
        google_detalhe = VALUES(google_detalhe),
        payload = VALUES(payload),
        buscado_em = VALUES(buscado_em),
        updated_at = VALUES(updated_at)
    `, [tabelaTexto, tabelaHistorico]);

    await knex(tabelaHistorico).where('tipo_busca', 'texto').delete();
  }

  await dropUniqueIfExists(knex, tabelaHistorico, ['chave']);
  await dropColumnIfExists(knex, tabelaHistorico, 'google_detalhe');
  await dropColumnIfExists(knex, tabelaHistorico, 'google_place_id');
  await dropColumnIfExists(knex, tabelaHistorico, 'termo_busca');
  await dropColumnIfExists(knex, tabelaHistorico, 'tipo_busca');
  await dropColumnIfExists(knex, tabelaHistorico, 'chave');

  await knex.schema.alterTable(tabelaHistorico, table => {
    table.string('cnpj', 14).notNullable().alter();
  });
  await addUniqueIfMissing(knex, tabelaHistorico, ['cnpj'], 'cnpj_buscas_realizadas_cnpj_unique');
};