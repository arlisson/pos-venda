const PERMISSAO = {
  chave: 'chat_usar',
  nome: 'Chat: usar',
  descricao: 'Permite acessar o chat interno e enviar mensagens a outros usuários.'
};

function parsePermissoes(permissoes) {
  if (!permissoes) return {};

  if (typeof permissoes === 'string') {
    try {
      return JSON.parse(permissoes);
    } catch {
      return {};
    }
  }

  if (Array.isArray(permissoes)) {
    return permissoes.reduce((acc, chave) => ({ ...acc, [chave]: true }), {});
  }

  return permissoes;
}

exports.up = async function (knex) {
  const existeMensagens = await knex.schema.hasTable('mensagens');

  if (!existeMensagens) {
    await knex.schema.createTable('mensagens', function (table) {
      table.increments('id').primary();
      table.integer('remetente_id').unsigned().notNullable()
        .references('id')
        .inTable('usuarios')
        .onDelete('CASCADE');
      table.integer('destinatario_id').unsigned().notNullable()
        .references('id')
        .inTable('usuarios')
        .onDelete('CASCADE');
      table.text('conteudo').notNullable();
      table.timestamp('lida_em').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['destinatario_id', 'lida_em']);
      table.index(['remetente_id', 'destinatario_id']);
    });
  }

  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({ ...PERMISSAO, ativo: true });
  } else {
    await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
  }

  for (const nomeRole of ['admin']) {
    const role = await knex('roles').where('nome', nomeRole).first();

    if (role) {
      await knex('roles')
        .where('id', role.id)
        .update({
          permissoes: JSON.stringify({
            ...parsePermissoes(role.permissoes),
            [PERMISSAO.chave]: true
          })
        });
    }
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('mensagens');
};
