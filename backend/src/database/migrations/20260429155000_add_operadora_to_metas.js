exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('metas', 'operadora_id');

  if (!hasColumn) {
    await knex.schema.alterTable('metas', function (table) {
      table
        .integer('operadora_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('operadoras')
        .onUpdate('CASCADE')
        .onDelete('SET NULL');
    });
  }

  const operadoras = await knex('operadoras').select('id', 'nome');
  const vivo = operadoras.find(operadora => String(operadora.nome || '').toLowerCase() === 'vivo');
  const claro = operadoras.find(operadora => String(operadora.nome || '').toLowerCase() === 'claro');
  const metas = await knex('metas')
    .select('id', 'desc', 'categoria')
    .where('categoria', 'portabilidade');

  for (const meta of metas) {
    const descricao = String(meta.desc || '').toLowerCase();
    const operadoraId = descricao.includes('vivo')
      ? vivo?.id
      : descricao.includes('claro')
        ? claro?.id
        : null;

    if (operadoraId) {
      await knex('metas')
        .where('id', meta.id)
        .update({ operadora_id: operadoraId });
    }
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('metas', 'operadora_id');

  if (!hasColumn) {
    return;
  }

  return knex.schema.alterTable('metas', function (table) {
    table.dropForeign(['operadora_id']);
    table.dropColumn('operadora_id');
  });
};
