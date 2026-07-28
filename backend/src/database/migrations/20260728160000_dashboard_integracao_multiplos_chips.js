const TABELA = 'dashboard_integracao_vendas';
const INDICE_ANTIGO = 'dashboard_integracao_vendas_venda_id_unique';
const INDICE_COMPOSTO = 'dashboard_integracao_vendas_item_unique';

async function indices(knex) {
  const [rows] = await knex.raw(`SHOW INDEX FROM ${TABELA}`);
  return new Set(rows.map(row => row.Key_name));
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn(TABELA, 'item_key'))) {
    await knex.schema.alterTable(TABELA, (table) => {
      table.string('item_key', 40).notNullable().defaultTo('principal').after('venda_id');
    });
  }

  let existentes = await indices(knex);
  if (!existentes.has(INDICE_COMPOSTO)) {
    await knex.schema.alterTable(TABELA, (table) => {
      // O prefixo venda_id preserva o índice necessário à chave estrangeira.
      table.unique(['venda_id', 'item_key'], INDICE_COMPOSTO);
    });
  }

  existentes = await indices(knex);
  if (existentes.has(INDICE_ANTIGO)) {
    await knex.schema.alterTable(TABELA, (table) => table.dropUnique(['venda_id']));
  }

  await knex.schema.alterTable(TABELA, (table) => {
    table.bigInteger('dashboard_sale_id').unsigned().nullable().alter();
  });
};

exports.down = async function down(knex) {
  const existentes = await indices(knex);
  if (existentes.has(INDICE_COMPOSTO)) {
    await knex.schema.alterTable(TABELA, (table) => table.dropUnique(['venda_id', 'item_key'], INDICE_COMPOSTO));
  }
  await knex.schema.alterTable(TABELA, (table) => {
    table.unique(['venda_id']);
    table.integer('dashboard_sale_id').unsigned().nullable().alter();
    table.dropColumn('item_key');
  });
};
