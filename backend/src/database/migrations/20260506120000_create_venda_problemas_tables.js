const PERMISSAO = {
  chave: 'vendas_marcar_problema',
  nome: 'Vendas: marcar problema',
  descricao: 'Permite abrir solicitacoes urgentes de problema em vendas.'
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
  const temPopupVisto = await knex.schema.hasColumn('notificacao_destinatarios', 'popup_visto_em');

  if (!temPopupVisto) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      table.timestamp('popup_visto_em').nullable();
      table.index(['usuario_id', 'popup_visto_em']);
    });
  }

  const existeVendaProblemas = await knex.schema.hasTable('venda_problemas');

  if (!existeVendaProblemas) {
    await knex.schema.createTable('venda_problemas', table => {
      table.increments('id').primary();
      table.integer('venda_id').unsigned().notNullable();
      table.integer('solicitante_id').unsigned().nullable();
      table.string('status', 40).notNullable().defaultTo('aberto');
      table.dateTime('aberto_em').notNullable().defaultTo(knex.fn.now());
      table.dateTime('resolvido_em').nullable();
      table.dateTime('verificado_em').nullable();
      table.timestamps(true, true);

      table.foreign('venda_id').references('id').inTable('vendas').onDelete('CASCADE');
      table.foreign('solicitante_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['venda_id', 'status']);
      table.index(['solicitante_id', 'status']);
    });
  }

  const existeDestinatarios = await knex.schema.hasTable('venda_problema_destinatarios');

  if (!existeDestinatarios) {
    await knex.schema.createTable('venda_problema_destinatarios', table => {
      table.increments('id').primary();
      table.integer('problema_id').unsigned().notNullable();
      table.integer('usuario_id').unsigned().notNullable();
      table.dateTime('resolvido_em').nullable();
      table.timestamps(true, true);

      table.foreign('problema_id').references('id').inTable('venda_problemas').onDelete('CASCADE');
      table.foreign('usuario_id').references('id').inTable('usuarios').onDelete('CASCADE');
      table.unique(['problema_id', 'usuario_id']);
      table.index(['usuario_id', 'resolvido_em']);
    });
  }

  const existeEventos = await knex.schema.hasTable('venda_problema_eventos');

  if (!existeEventos) {
    await knex.schema.createTable('venda_problema_eventos', table => {
      table.increments('id').primary();
      table.integer('problema_id').unsigned().notNullable();
      table.integer('usuario_id').unsigned().nullable();
      table.string('tipo', 40).notNullable();
      table.text('mensagem').notNullable();
      table.json('dados').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('problema_id').references('id').inTable('venda_problemas').onDelete('CASCADE');
      table.foreign('usuario_id').references('id').inTable('usuarios').onDelete('SET NULL');
      table.index(['problema_id', 'created_at']);
    });
  }

  const permissaoExistente = await knex('permissoes').where('chave', PERMISSAO.chave).first();

  if (permissaoExistente) {
    await knex('permissoes')
      .where('id', permissaoExistente.id)
      .update({ ...PERMISSAO, ativo: true });
  } else {
    await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
  }

  const roleAdmin = await knex('roles').where('nome', 'admin').first();

  if (roleAdmin) {
    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify({
          ...parsePermissoes(roleAdmin.permissoes),
          [PERMISSAO.chave]: true
        })
      });
  }
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });

  await knex.schema.dropTableIfExists('venda_problema_eventos');
  await knex.schema.dropTableIfExists('venda_problema_destinatarios');
  await knex.schema.dropTableIfExists('venda_problemas');

  const temPopupVisto = await knex.schema.hasColumn('notificacao_destinatarios', 'popup_visto_em');

  if (temPopupVisto) {
    await knex.schema.alterTable('notificacao_destinatarios', table => {
      table.dropIndex(['usuario_id', 'popup_visto_em']);
      table.dropColumn('popup_visto_em');
    });
  }
};
