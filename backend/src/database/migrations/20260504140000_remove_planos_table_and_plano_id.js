exports.up = function(knex) {
  return knex.schema.hasColumn('vendas', 'plano_id').then(exists => {
    if (exists) {
      return knex.schema.table('vendas', function(table) {
        try { table.dropForeign(['plano_id']); } catch (e) { /* ignore */ }
        table.dropColumn('plano_id');
      });
    }
    return null;
  }).then(() => knex.schema.dropTableIfExists('planos'));
};

exports.down = function(knex) {
  return knex.schema.createTable('planos', function(table) {
    table.increments('id');
    table.integer('operadora_id').unsigned();
    table.string('nome');
    table.decimal('taxa_comissao', 8, 2).defaultTo(0);
    table.string('categoria');
    table.string('tipo_servico');
    table.boolean('ativo').defaultTo(true);
    table.timestamps(true, true);
  }).then(() => knex.schema.hasTable('vendas').then(() => {
    return knex.schema.table('vendas', function(table) {
      table.integer('plano_id').unsigned().nullable();
      table.foreign('plano_id').references('planos.id');
    });
  }));
};
