const PERMISSAO = {
  chave: 'operar_mailing',
  nome: 'Operar mailing',
  descricao: 'Permite consultar mailings, limpar tentativas de contato e cancelar envios.'
};

exports.up = async function (knex) {
  await knex.schema.table('lead_envios', table => {
    table.timestamp('cancelado_em').nullable();
    table.integer('cancelado_por_id').unsigned().nullable()
      .references('id').inTable('usuarios').onUpdate('CASCADE').onDelete('SET NULL');
    table.index(['cancelado_em'], 'lead_envios_cancelado_em_idx');
  });
  await knex.raw("ALTER TABLE lead_atribuicoes MODIFY status ENUM('atribuido', 'qualificado', 'nao_qualificado', 'sem_contato', 'invalido', 'vendido', 'perdido', 'cancelado') NOT NULL DEFAULT 'atribuido'");
  const existente = await knex('permissoes').where('chave', PERMISSAO.chave).first();
  if (existente) await knex('permissoes').where('id', existente.id).update({ ...PERMISSAO, ativo: true });
  else await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
};

exports.down = async function (knex) {
  await knex('permissoes').where('chave', PERMISSAO.chave).delete();
  await knex.raw("ALTER TABLE lead_atribuicoes MODIFY status ENUM('atribuido', 'qualificado', 'nao_qualificado', 'sem_contato', 'invalido', 'vendido', 'perdido') NOT NULL DEFAULT 'atribuido'");
  await knex.schema.table('lead_envios', table => {
    table.dropIndex(['cancelado_em'], 'lead_envios_cancelado_em_idx');
    table.dropColumn('cancelado_por_id');
    table.dropColumn('cancelado_em');
  });
};