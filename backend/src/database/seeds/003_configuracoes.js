const OPERADORAS = [
  { nome: 'Vivo', ordem: 1 },
  { nome: 'TIM', ordem: 2 },
  { nome: 'Claro', ordem: 3 }
];

const TIPOS_VENDA = [
  { nome: 'Novo', ordem: 1 },
  { nome: 'Portabilidade', ordem: 2 }
];

const SERVICOS = [
  { nome: 'Internet', ordem: 1 },
  { nome: 'Telefonia fixa', ordem: 2 },
  { nome: 'Telefonia móvel', ordem: 3 }
];

const LINKS_EXTERNOS = [
  {
    chave: 'receita-cnpj',
    nome: 'Receita CNPJ',
    url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=65186256000180',
    dot: 'gov',
    ordem: 1
  },
  {
    chave: 'abr-telecom',
    nome: 'ABR Telecom',
    url: 'https://consultanumero.abrtelecom.com.br/consultanumero/consulta/consultaSituacaoAtualCtg',
    dot: 'abr',
    ordem: 2
  },
  {
    chave: 'vivo-mve',
    nome: 'Vivo MVE',
    url: 'https://mve.vivo.com.br/oauth?logout=true',
    dot: 'vivo',
    ordem: 3
  },
  {
    chave: 'vivo-cobertura',
    nome: 'Vivo Cobertura',
    url: 'https://vivo.com.br/para-voce/por-que-vivo/qualidade/cobertura',
    dot: 'vivo',
    ordem: 4
  },
  {
    chave: 'tim-negocia',
    nome: 'TIM Negocia',
    url: 'https://timnegocia.com.br/',
    dot: 'tim',
    ordem: 5
  },
  {
    chave: 'meu-tim',
    nome: 'Meu TIM',
    url: 'https://meutim.tim.com.br/novo',
    dot: 'tim',
    ordem: 6
  },
  {
    chave: 'claro-acesso',
    nome: 'Minha Claro',
    url: 'https://minhaclaro.claro.com.br/acesso-rapido/',
    dot: 'claro',
    ordem: 7
  },
  {
    chave: 'claro-cobertura',
    nome: 'Claro Cobertura',
    url: 'https://www.claro.com.br/mapa-de-cobertura?srsltid=AfmBOoo6nyH43Cy_Tmy1RbxKaKLlpmftwCGEshrnN4FZz__aZVj2NppU',
    dot: 'claro',
    ordem: 8
  }
];

async function upsertPorCampo(knex, tabela, campo, item) {
  const existente = await knex(tabela).where(campo, item[campo]).first();

  if (existente) {
    return knex(tabela).where('id', existente.id).update({
      ...item,
      updated_at: knex.fn.now()
    });
  }

  return knex(tabela).insert(item);
}

exports.seed = async function (knex) {
  for (const operadora of OPERADORAS) {
    await upsertPorCampo(knex, 'operadoras', 'nome', operadora);
  }

  for (const tipoVenda of TIPOS_VENDA) {
    await upsertPorCampo(knex, 'tipos_venda', 'nome', tipoVenda);
  }

  for (const servico of SERVICOS) {
    await upsertPorCampo(knex, 'servicos', 'nome', servico);
  }

  for (const link of LINKS_EXTERNOS) {
    await upsertPorCampo(knex, 'links_externos', 'chave', link);
  }
};
