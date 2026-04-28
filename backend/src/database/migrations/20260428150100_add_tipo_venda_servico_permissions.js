const PERMISSOES = [
  {
    chave: 'crud_tipos_venda',
    nome: 'Cadastro de tipos de venda',
    descricao: 'Permite criar, editar, listar e desativar tipos de venda.'
  },
  {
    chave: 'crud_servicos',
    nome: 'Cadastro de servicos',
    descricao: 'Permite criar, editar, listar e desativar servicos.'
  }
];

exports.up = async function (knex) {
  for (const permissao of PERMISSOES) {
    const existente = await knex('permissoes').where('chave', permissao.chave).first();

    if (existente) {
      await knex('permissoes').where('id', existente.id).update({
        nome: permissao.nome,
        descricao: permissao.descricao,
        ativo: true
      });
    } else {
      await knex('permissoes').insert({ ...permissao, ativo: true });
    }
  }
};

exports.down = function (knex) {
  return knex('permissoes')
    .whereIn('chave', PERMISSOES.map(permissao => permissao.chave))
    .del();
};
