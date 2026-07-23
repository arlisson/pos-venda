const TIPOS = [
  ['venda_problema_aberto', 'Problema de venda aberto', '#2563eb'],
  ['venda_problema_resolvido', 'Problema de venda resolvido', '#2563eb'],
  ['venda_problema_correcao', 'Correcao solicitada na venda', '#2563eb'],
  ['venda_retorno_registrado', 'Retorno de venda registrado', '#dc2626'],
  ['venda_aprovacao_pendente', 'Aprovacao de venda pendente', '#e87900'],
  ['venda_parada_funil', 'Venda parada no funil', '#e87900'],
  ['cliente_fidelidade', 'Cliente em fidelidade', '#e87900'],
  ['nota_retorno_pre', 'Retorno de nota proximo', '#16a34a'],
  ['nota_retorno_due', 'Retorno de nota vencido', '#16a34a'],
  ['futuro_cliente_retorno_pre', 'Retorno de futuro cliente proximo', '#16a34a'],
  ['futuro_cliente_retorno_due', 'Retorno de futuro cliente vencido', '#16a34a'],
  ['lead_retorno_pre', 'Retorno de lead proximo', '#16a34a'],
  ['lead_retorno_due', 'Retorno de lead vencido', '#16a34a']
];

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('notificacao_aparencias'))) {
    await knex.schema.createTable('notificacao_aparencias', table => {
      table.increments('id').primary();
      table.string('tipo', 80).notNullable().unique();
      table.string('nome', 160).notNullable();
      table.string('cor', 7).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  for (const [tipo, nome, cor] of TIPOS) {
    if (!(await knex('notificacao_aparencias').where({ tipo }).first())) {
      await knex('notificacao_aparencias').insert({ tipo, nome, cor });
    }
  }

  const permissao = {
    chave: 'configurar_notificacoes',
    nome: 'Configurar notificacoes',
    descricao: 'Permite ajustar as cores dos alertas flutuantes por tipo de notificacao.'
  };
  const existente = await knex('permissoes').where('chave', permissao.chave).first();
  if (existente) await knex('permissoes').where('id', existente.id).update({ ...permissao, ativo: true });
  else await knex('permissoes').insert({ ...permissao, ativo: true });

  const admin = await knex('roles').where('nome', 'admin').first();
  if (admin) {
    let permissoes = {};
    try { permissoes = typeof admin.permissoes === 'string' ? JSON.parse(admin.permissoes || '{}') : (admin.permissoes || {}); } catch {}
    await knex('roles').where('id', admin.id).update({
      permissoes: JSON.stringify({ ...permissoes, configurar_notificacoes: true })
    });
  }
};

exports.down = async function (knex) {
  await knex('permissoes').where('chave', 'configurar_notificacoes').update({ ativo: false });
  await knex.schema.dropTableIfExists('notificacao_aparencias');
};
