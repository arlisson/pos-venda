const PERMISSOES = [
  {
    chave: 'futuros_clientes_ver',
    nome: 'Futuros clientes: visualizar',
    descricao: 'Permite acessar a pagina de futuros clientes e ver leads marcados como futuro cliente.'
  },
  {
    chave: 'futuros_clientes_registrar',
    nome: 'Futuros clientes: registrar',
    descricao: 'Permite marcar um lead recebido como futuro cliente com notas e data de retorno.'
  }
];

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes').where('chave', permissao.chave).first();
    if (existente) {
      await knex('permissoes').where('id', existente.id).update({ ...permissao, ativo: true });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }
};

exports.down = async function (knex) {
  await knex('permissoes').whereIn('chave', PERMISSOES.map(p => p.chave)).delete();
};
