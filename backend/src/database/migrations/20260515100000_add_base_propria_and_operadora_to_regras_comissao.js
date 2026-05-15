exports.up = async function (knex) {
  const existeTabela = await knex.schema.hasTable('regras_comissao');
  if (!existeTabela) return;

  const hasOperadora = await knex.schema.hasColumn('regras_comissao', 'operadora_id');
  const hasBasePropria = await knex.schema.hasColumn('regras_comissao', 'valor_comissao_base_propria');
  const hasPrioridade = await knex.schema.hasColumn('regras_comissao', 'prioridade_base_dupla');

  await knex.schema.alterTable('regras_comissao', function (table) {
    if (!hasOperadora) {
      table
        .integer('operadora_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('operadoras')
        .onUpdate('CASCADE')
        .onDelete('SET NULL')
        .after('id');
    }

    if (!hasBasePropria) {
      table.decimal('valor_comissao_base_propria', 10, 2).notNullable().defaultTo(0).after('valor_comissao_base');
    }

    if (!hasPrioridade) {
      table.string('prioridade_base_dupla', 30).notNullable().defaultTo('base_propria').after('valor_comissao_base_propria');
    }
  });

  if (!hasBasePropria) {
    await knex('regras_comissao').update({
      valor_comissao_base_propria: knex.raw('COALESCE(valor_comissao_base, valor_comissao, 0)')
    });
  }

  const hasIndex = async (indexName) => {
    const [rows] = await knex.raw(
      `
        SELECT INDEX_NAME
        FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1
      `,
      ['regras_comissao', indexName]
    );

    return rows.length > 0;
  };

  if (!(await hasIndex('regras_comissao_operadora_faixa_idx'))) {
    await knex.schema.alterTable('regras_comissao', function (table) {
      table.index(['operadora_id', 'ativo', 'valor_min', 'valor_max'], 'regras_comissao_operadora_faixa_idx');
    });
  }
};

exports.down = async function (knex) {
  const existeTabela = await knex.schema.hasTable('regras_comissao');
  if (!existeTabela) return;

  const hasIndex = async (indexName) => {
    const [rows] = await knex.raw(
      `
        SELECT INDEX_NAME
        FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1
      `,
      ['regras_comissao', indexName]
    );

    return rows.length > 0;
  };

  const hasOperadora = await knex.schema.hasColumn('regras_comissao', 'operadora_id');
  const hasBasePropria = await knex.schema.hasColumn('regras_comissao', 'valor_comissao_base_propria');
  const hasPrioridade = await knex.schema.hasColumn('regras_comissao', 'prioridade_base_dupla');
  const existeIndex = await hasIndex('regras_comissao_operadora_faixa_idx');

  await knex.schema.alterTable('regras_comissao', function (table) {
    if (existeIndex) {
      table.dropIndex(['operadora_id', 'ativo', 'valor_min', 'valor_max'], 'regras_comissao_operadora_faixa_idx');
    }

    if (hasOperadora) {
      table.dropForeign(['operadora_id']);
      table.dropColumn('operadora_id');
    }

    if (hasBasePropria) {
      table.dropColumn('valor_comissao_base_propria');
    }

    if (hasPrioridade) {
      table.dropColumn('prioridade_base_dupla');
    }
  });
};
