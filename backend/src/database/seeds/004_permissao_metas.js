/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // 1. Insere a nova permissão para gerenciar metas
  // Usamos o campo 'chave' como identificador único
  await knex('permissoes').insert({
    chave: 'gerenciar_metas',
    nome: 'Gerenciar Metas',
    descricao: 'Permite configurar as metas globais e de gamificação',
    ativo: true
  }).onConflict('chave').ignore();

  // 2. Busca o ID da permissão que acabamos de criar e o ID da role 'admin'
  const permissao = await knex('permissoes').where('chave', 'gerenciar_metas').first();
  const roleAdmin = await knex('roles').where('nome', 'admin').first();

  // 3. Associa a permissão ao perfil administrador na tabela intermediária
  if (permissao && roleAdmin) {
    await knex('roles_permissoes').insert({
      role_id: roleAdmin.id,
      permissao_id: permissao.id
    }).onConflict(['role_id', 'permissao_id']).ignore();
  }
};