const PERMISSOES = [
  {
    chave: 'notificacoes_visualizar',
    nome: 'Notificacoes: visualizar',
    descricao: 'Permite visualizar as proprias notificacoes do sistema.'
  },
  {
    chave: 'notificacoes_receber_todas',
    nome: 'Notificacoes: receber todas',
    descricao: 'Permite receber todas as notificacoes geradas pelo sistema.'
  }
];

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
  const existeNotificacoes = await knex.schema.hasTable('notificacoes');

  if (!existeNotificacoes) {
    await knex.schema.createTable('notificacoes', function (table) {
      table.increments('id').primary();
      table.string('tipo', 80).notNullable();
      table.string('titulo', 160).notNullable();
      table.text('mensagem').nullable();
      table.string('nivel', 30).notNullable().defaultTo('info');
      table.string('entidade', 80).nullable();
      table.integer('entidade_id').nullable();
      table.string('source_key', 160).notNullable().unique();
      table.json('dados').nullable();
      table.boolean('ativa').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const existeDestinatarios = await knex.schema.hasTable('notificacao_destinatarios');

  if (!existeDestinatarios) {
    await knex.schema.createTable('notificacao_destinatarios', function (table) {
      table.increments('id').primary();
      table.integer('notificacao_id').unsigned().notNullable()
        .references('id')
        .inTable('notificacoes')
        .onDelete('CASCADE');
      table.integer('usuario_id').unsigned().notNullable()
        .references('id')
        .inTable('usuarios')
        .onDelete('CASCADE');
      table.timestamp('lida_em').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['notificacao_id', 'usuario_id']);
      table.index(['usuario_id', 'lida_em']);
    });
  }

  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes')
      .where('chave', permissao.chave)
      .first();

    if (existente) {
      await knex('permissoes')
        .where('id', existente.id)
        .update({
          ...permissao,
          ativo: true
        });
    } else {
      await knex('permissoes').insert({
        ...permissao,
        ativo: true
      });
    }
  }

  const roleAdmin = await knex('roles')
    .where('nome', 'admin')
    .first();

  if (roleAdmin) {
    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(roleAdmin.permissoes),
          notificacoes_visualizar: true,
          notificacoes_receber_todas: true
        })
      });
  }

  const roleUsuario = await knex('roles')
    .where('nome', 'usuario')
    .first();

  if (roleUsuario) {
    await knex('roles')
      .where('id', roleUsuario.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(roleUsuario.permissoes),
          notificacoes_visualizar: false,
          notificacoes_receber_todas: false
        })
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('notificacao_destinatarios');
  await knex.schema.dropTableIfExists('notificacoes');
};
