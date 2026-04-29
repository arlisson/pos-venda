exports.up = async function (knex) {
  await knex.schema.alterTable('clientes', function (table) {
    table.timestamp('excluido_em').nullable();
    table.timestamp('excluir_definitivo_em').nullable();
    table
      .integer('excluido_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table.index(['excluido_em']);
    table.index(['excluir_definitivo_em']);
    table.index(['excluido_por_id']);
  });

  await knex.schema.alterTable('vendas', function (table) {
    table.timestamp('excluido_em').nullable();
    table.timestamp('excluir_definitivo_em').nullable();
    table
      .integer('excluido_por_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('usuarios')
      .onUpdate('CASCADE')
      .onDelete('SET NULL');

    table.index(['excluido_em']);
    table.index(['excluir_definitivo_em']);
    table.index(['excluido_por_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('vendas', function (table) {
    table.dropIndex(['excluido_em']);
    table.dropIndex(['excluir_definitivo_em']);
    table.dropIndex(['excluido_por_id']);
    table.dropForeign(['excluido_por_id']);
    table.dropColumn('excluido_por_id');
    table.dropColumn('excluir_definitivo_em');
    table.dropColumn('excluido_em');
  });

  await knex.schema.alterTable('clientes', function (table) {
    table.dropIndex(['excluido_em']);
    table.dropIndex(['excluir_definitivo_em']);
    table.dropIndex(['excluido_por_id']);
    table.dropForeign(['excluido_por_id']);
    table.dropColumn('excluido_por_id');
    table.dropColumn('excluir_definitivo_em');
    table.dropColumn('excluido_em');
  });
};
