const COLUNAS = ['etapa_0800', 'etapa_abr', 'etapa_vivo'];

exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    COLUNAS.forEach((prefixo) => {
      table.boolean(`${prefixo}_concluida`).notNullable().defaultTo(false);
      table.datetime(`${prefixo}_concluida_em`).nullable();
      table.integer(`${prefixo}_concluida_por_id`).unsigned().nullable();
    });
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    COLUNAS.forEach((prefixo) => {
      table.dropColumn(`${prefixo}_concluida`);
      table.dropColumn(`${prefixo}_concluida_em`);
      table.dropColumn(`${prefixo}_concluida_por_id`);
    });
  });
};
