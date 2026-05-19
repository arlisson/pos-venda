const PERMISSOES = [
  {
    chave: 'vendas_cancelar',
    nome: 'Vendas: cancelar',
    descricao: 'Permite marcar uma venda como cancelada a partir do funil.'
  },
  {
    chave: 'vendas_reverter_cancelamento',
    nome: 'Vendas: reverter cancelamento',
    descricao: 'Permite reverter o cancelamento de uma venda, devolvendo-a ao estado normal.'
  },
  {
    chave: 'notificacoes_venda_cancelada',
    nome: 'Notificacoes: receber venda cancelada',
    descricao: 'Permite receber a notificacao quando uma venda for cancelada.'
  }
];

function parsePermissoes(permissoes) {
  if (!permissoes) return {};

  if (typeof permissoes === 'string') {
    try {
      return parsePermissoes(JSON.parse(permissoes));
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

  const roleAdmin = await knex('roles').where('nome', 'admin').first();

  if (roleAdmin) {
    const atuais = parsePermissoes(roleAdmin.permissoes);
    const atualizadas = { ...atuais };

    for (const permissao of PERMISSOES) {
      atualizadas[permissao.chave] = true;
    }

    await knex('roles')
      .where('id', roleAdmin.id)
      .update({
        permissoes: JSON.stringify(atualizadas),
        updated_at: knex.fn.now()
      });
  }
};

exports.down = async function (knex) {
  for (const permissao of PERMISSOES) {
    await knex('permissoes')
      .where('chave', permissao.chave)
      .update({ ativo: false });
  }
};
