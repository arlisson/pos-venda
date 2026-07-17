const PERMISSAO = {
  chave: 'futuros_clientes_buscar_telefone_google',
  nome: 'Futuros clientes: buscar telefone no Google',
  descricao: 'Permite buscar no Google o telefone de leads cuja primeira chamada não foi atendida.'
};

function parsePermissoes(valor) {
  if (!valor) return {};
  if (typeof valor === 'object') return valor;
  try {
    return JSON.parse(valor);
  } catch {
    return {};
  }
}

exports.up = async function (knex) {
  const existente = await knex('permissoes').where('chave', PERMISSAO.chave).first();

  if (existente) {
    await knex('permissoes').where('id', existente.id).update({ ...PERMISSAO, ativo: true });
  } else {
    await knex('permissoes').insert({ ...PERMISSAO, ativo: true });
  }

  const roleAdmin = await knex('roles').where('nome', 'admin').first();
  if (roleAdmin) {
    await knex('roles').where('id', roleAdmin.id).update({
      permissoes: JSON.stringify({
        ...parsePermissoes(roleAdmin.permissoes),
        [PERMISSAO.chave]: true
      })
    });
  }
};

exports.down = async function (knex) {
  await knex('permissoes').where('chave', PERMISSAO.chave).delete();
};
