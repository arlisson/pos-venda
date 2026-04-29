const LEGACY_CATEGORIAS = {
  clientes: 'registro_cliente',
  chips: 'chip_novo',
  port_vivo: 'portabilidade',
  port_claro: 'portabilidade',
  negociacoes: 'registro_cliente',
  internet: 'internet'
};

function resolveCategoria(tipo) {
  return LEGACY_CATEGORIAS[tipo] || 'registro_cliente';
}

async function indexExists(knex, tableName, indexName) {
  const [rows] = await knex.raw(
    `
      SELECT INDEX_NAME
      FROM information_schema.statistics
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  return rows.length > 0;
}

exports.up = async function(knex) {
  if (await indexExists(knex, 'metas', 'metas_tipo_unique')) {
    await knex.schema.alterTable('metas', table => {
      table.dropUnique(['tipo']);
    });
  }

  const hasPeriodo = await knex.schema.hasColumn('metas', 'periodo');
  const hasCategoria = await knex.schema.hasColumn('metas', 'categoria');

  if (!hasPeriodo || !hasCategoria) {
    await knex.schema.alterTable('metas', table => {
      if (!hasPeriodo) {
        table.string('periodo', 20).notNullable().defaultTo('diaria');
      }

      if (!hasCategoria) {
        table.string('categoria', 40).notNullable().defaultTo('registro_cliente');
      }
    });
  }

  const metas = await knex('metas').select('id', 'tipo', 'is_gift');

  for (const meta of metas) {
    const periodo = meta.tipo === 'semanal' ? 'semanal' : 'diaria';
    const categoria = meta.is_gift ? resolveCategoria(meta.tipo) : 'registro_cliente';
    const tipo = meta.is_gift ? `${periodo}_${categoria}` : meta.tipo;

    await knex('metas')
      .where({ id: meta.id })
      .update({ periodo, categoria, tipo });
  }
};

exports.down = async function(knex) {
  const hasPeriodo = await knex.schema.hasColumn('metas', 'periodo');
  const hasCategoria = await knex.schema.hasColumn('metas', 'categoria');

  if (!hasPeriodo && !hasCategoria) {
    return;
  }

  return knex.schema.alterTable('metas', table => {
    if (hasPeriodo) {
      table.dropColumn('periodo');
    }

    if (hasCategoria) {
      table.dropColumn('categoria');
    }
  });
};
