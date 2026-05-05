/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Rename tables
  await knex.schema.renameTable('metas', 'campanhas');
  await knex.schema.renameTable('meta_resgates', 'campanha_resgates');

  // Update permissions keys
  await knex('permissoes')
    .where('chave', 'gerenciar_metas')
    .update({
      chave: 'gerenciar_campanhas',
      nome: 'Gerenciar Campanhas',
      descricao: 'Permite configurar as campanhas globais e de gamificação'
    });

  await knex('permissoes')
    .where('chave', 'metas_ver_usuarios')
    .update({
      chave: 'campanhas_ver_usuarios',
      nome: 'Campanhas: ver por usuário',
      descricao: 'Permite acompanhar no dashboard quais usuários bateram ou não as campanhas.'
    });

  // Update foreign key column name in campanha_resgates if needed
  // Looking at 20260429120000_create_meta_resgates_table.js:
  // table.integer('meta_id').unsigned().notNullable();
  await knex.schema.alterTable('campanha_resgates', table => {
    table.renameColumn('meta_id', 'campanha_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('campanha_resgates', table => {
    table.renameColumn('campanha_id', 'meta_id');
  });

  await knex('permissoes')
    .where('chave', 'campanhas_ver_usuarios')
    .update({
      chave: 'metas_ver_usuarios',
      nome: 'Metas: ver por usuário',
      descricao: 'Permite acompanhar no dashboard quais usuários bateram ou não as metas.'
    });

  await knex('permissoes')
    .where('chave', 'gerenciar_campanhas')
    .update({
      chave: 'gerenciar_metas',
      nome: 'Gerenciar Metas',
      descricao: 'Permite configurar as metas globais e de gamificação'
    });

  await knex.schema.renameTable('campanha_resgates', 'meta_resgates');
  await knex.schema.renameTable('campanhas', 'metas');
};
