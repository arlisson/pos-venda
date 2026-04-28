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

exports.up = async function(knex) {
  await knex.schema.alterTable('metas', table => {
    table.dropUnique(['tipo']);
  });

  await knex.schema.alterTable('metas', table => {
    table.string('periodo', 20).notNullable().defaultTo('diaria');
    table.string('categoria', 40).notNullable().defaultTo('registro_cliente');
  });

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

exports.down = function(knex) {
  return knex.schema.alterTable('metas', table => {
    table.dropColumn('periodo');
    table.dropColumn('categoria');
  });
};
