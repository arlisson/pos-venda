/** Preserva os resultados da primeira ligação quando um lead é reaberto para reenvio. */
exports.up = async function (knex) {
  const tabela = 'lead_linhas';
  const colunas = [
    ['primeira_ligacao_status', table => table.string('primeira_ligacao_status', 40).nullable()],
    ['primeira_ligacao_em', table => table.datetime('primeira_ligacao_em').nullable()],
    ['primeira_ligacao_usuario_id', table => table.integer('primeira_ligacao_usuario_id').unsigned().nullable().references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL')]
  ];
  for (const [nome, adicionar] of colunas) {
    if (!await knex.schema.hasColumn(tabela, nome)) await knex.schema.table(tabela, adicionar);
  }
};

exports.down = async function (knex) {
  const tabela = 'lead_linhas';
  for (const coluna of ['primeira_ligacao_usuario_id', 'primeira_ligacao_em', 'primeira_ligacao_status']) {
    if (await knex.schema.hasColumn(tabela, coluna)) await knex.schema.table(tabela, table => table.dropColumn(coluna));
  }
};