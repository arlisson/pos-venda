const PERMISSAO = {
  chave: 'vendas_cruzar',
  nome: 'Vendas: cruzar vendas',
  descricao: 'Permite acessar a tela de cruzamento de vendas e gerar a planilha final.'
};

const PERMISSAO_LEGADA = 'clientes_importar_planilhas';

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

async function upsertPermissao(knex) {
  const existente = await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .first();

  if (existente) {
    await knex('permissoes')
      .where('id', existente.id)
      .update({
        ...PERMISSAO,
        ativo: true
      });
    return;
  }

  await knex('permissoes').insert({
    ...PERMISSAO,
    ativo: true
  });
}

async function migrarPermissaoLegada(knex, tabela, opcoes = {}) {
  const registros = await knex(tabela).select('id', 'nome', 'permissoes');

  for (const registro of registros) {
    const permissoes = parsePermissoes(registro.permissoes);
    const deveLiberar = (opcoes.liberarAdmin && registro.nome === 'admin') || permissoes[PERMISSAO_LEGADA] === true;

    if (permissoes[PERMISSAO_LEGADA] === false && permissoes[PERMISSAO.chave] === undefined) {
      await knex(tabela)
        .where('id', registro.id)
        .update({
          permissoes: JSON.stringify({
            ...permissoes,
            [PERMISSAO.chave]: false
          }),
          updated_at: knex.fn.now()
        });
      continue;
    }

    if (!deveLiberar || permissoes[PERMISSAO.chave] === true) continue;

    await knex(tabela)
      .where('id', registro.id)
      .update({
        permissoes: JSON.stringify({
          ...permissoes,
          [PERMISSAO.chave]: true
        }),
        updated_at: knex.fn.now()
      });
  }
}

exports.up = async function (knex) {
  await upsertPermissao(knex);
  await migrarPermissaoLegada(knex, 'roles', { liberarAdmin: true });
  await migrarPermissaoLegada(knex, 'usuarios');
};

exports.down = async function (knex) {
  await knex('permissoes')
    .where('chave', PERMISSAO.chave)
    .update({ ativo: false });
};
