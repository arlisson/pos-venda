exports.up = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.integer('operadora_interesse_id').unsigned().nullable()
      .references('id').inTable('operadoras').onUpdate('CASCADE').onDelete('SET NULL')
      .after('operadora_atual_id');
    table.index(['operadora_interesse_id'], 'lead_sondagens_operadora_interesse_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('lead_sondagens', table => {
    table.dropIndex(['operadora_interesse_id'], 'lead_sondagens_operadora_interesse_idx');
    table.dropColumn('operadora_interesse_id');
  });
};