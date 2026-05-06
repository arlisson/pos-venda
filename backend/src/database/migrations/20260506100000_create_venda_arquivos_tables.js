exports.up = async function (knex) {
  await knex.schema.createTable('arquivos', table => {
    table.increments('id').primary();
    table.string('hash_sha256', 64).notNullable().unique();
    table.string('mime_type', 120).notNullable();
    table.string('extensao', 20).nullable();
    table.bigInteger('tamanho_bytes').notNullable().defaultTo(0);
    table.string('storage_driver', 40).notNullable().defaultTo('local');
    table.string('storage_path', 700).notNullable();
    table.integer('criado_por_id').unsigned().nullable();
    table.dateTime('removido_em').nullable();
    table.timestamps(true, true);

    table.foreign('criado_por_id').references('id').inTable('usuarios').onDelete('SET NULL');
  });

  await knex.schema.createTable('venda_arquivos', table => {
    table.increments('id').primary();
    table.integer('venda_id').unsigned().notNullable();
    table.integer('arquivo_id').unsigned().notNullable();
    table.string('nome_original', 255).notNullable();
    table.string('categoria', 40).notNullable().defaultTo('outro');
    table.string('descricao', 500).nullable();
    table.integer('ordem').notNullable().defaultTo(0);
    table.integer('criado_por_id').unsigned().nullable();
    table.integer('arquivado_no_pacote_id').unsigned().nullable();
    table.dateTime('remover_apos').nullable();
    table.dateTime('excluido_em').nullable();
    table.timestamps(true, true);

    table.foreign('venda_id').references('id').inTable('vendas').onDelete('CASCADE');
    table.foreign('arquivo_id').references('id').inTable('arquivos').onDelete('RESTRICT');
    table.foreign('criado_por_id').references('id').inTable('usuarios').onDelete('SET NULL');
    table.index(['venda_id', 'excluido_em']);
    table.index(['arquivo_id']);
  });

  await knex.schema.createTable('venda_arquivo_pacotes', table => {
    table.increments('id').primary();
    table.integer('venda_id').unsigned().notNullable();
    table.string('status', 30).notNullable().defaultTo('pendente');
    table.string('hash_sha256', 64).nullable();
    table.bigInteger('tamanho_bytes').nullable();
    table.string('storage_driver', 40).notNullable().defaultTo('local');
    table.string('storage_path', 700).nullable();
    table.integer('total_arquivos').notNullable().defaultTo(0);
    table.text('erro').nullable();
    table.integer('gerado_por_id').unsigned().nullable();
    table.dateTime('gerado_em').nullable();
    table.timestamps(true, true);

    table.foreign('venda_id').references('id').inTable('vendas').onDelete('CASCADE');
    table.foreign('gerado_por_id').references('id').inTable('usuarios').onDelete('SET NULL');
    table.index(['venda_id', 'status']);
  });

  await knex.schema.alterTable('venda_arquivos', table => {
    table.foreign('arquivado_no_pacote_id').references('id').inTable('venda_arquivo_pacotes').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('venda_arquivos', table => {
    table.dropForeign(['arquivado_no_pacote_id']);
  });

  await knex.schema.dropTableIfExists('venda_arquivo_pacotes');
  await knex.schema.dropTableIfExists('venda_arquivos');
  await knex.schema.dropTableIfExists('arquivos');
};
