exports.up = async function (knex) {
  await knex.schema.table('vendas', table => {
    table.integer('origem_lead_linha_id').unsigned().nullable()
      .references('id').inTable('lead_linhas').onUpdate('CASCADE').onDelete('SET NULL');
    table.integer('origem_sondador_id').unsigned().nullable()
      .references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL');
    table.index(['origem_lead_linha_id'], 'vendas_origem_lead_idx');
    table.index(['origem_sondador_id'], 'vendas_origem_sondador_idx');
  });
  await knex.schema.table('clientes', table => {
    table.integer('origem_lead_linha_id').unsigned().nullable()
      .references('id').inTable('lead_linhas').onUpdate('CASCADE').onDelete('SET NULL');
    table.integer('origem_sondador_id').unsigned().nullable()
      .references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL');
    table.index(['origem_lead_linha_id'], 'clientes_origem_lead_idx');
    table.index(['origem_sondador_id'], 'clientes_origem_sondador_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('clientes', table => {
    table.dropIndex(['origem_sondador_id'], 'clientes_origem_sondador_idx');
    table.dropIndex(['origem_lead_linha_id'], 'clientes_origem_lead_idx');
    table.dropColumn('origem_sondador_id');
    table.dropColumn('origem_lead_linha_id');
  });
  await knex.schema.table('vendas', table => {
    table.dropIndex(['origem_sondador_id'], 'vendas_origem_sondador_idx');
    table.dropIndex(['origem_lead_linha_id'], 'vendas_origem_lead_idx');
    table.dropColumn('origem_sondador_id');
    table.dropColumn('origem_lead_linha_id');
  });
};
