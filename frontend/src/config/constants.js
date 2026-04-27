export const STAGES = [
  { id: 'aprovacao', name: 'Aprovação', dot: 'aprovacao' },
  { id: 'ativacao', name: 'Ativação', dot: 'ativacao' },
  { id: 'envio', name: 'Envio / Logística', dot: 'envio' },
  { id: 'entrega', name: 'Entrega', dot: 'entrega' },
  { id: 'confirmacao', name: 'Confirmação do cliente', dot: 'confirmacao' },
  { id: 'concluido', name: 'Concluído', dot: 'concluido' },
];

export const RETURN_STAGES = [
  { id: 'retorno', name: 'Retorno recebido', dot: 'retorno' },
];

export const OPERATORS = ['Vivo', 'TIM', 'Claro'];

export const EXTERNAL_LINKS = [
  { id: 'receita-cnpj', name: 'Receita CNPJ', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=65186256000180', dot: 'gov' },
  { id: 'abr-telecom', name: 'ABR Telecom', url: 'https://consultanumero.abrtelecom.com.br/consultanumero/consulta/consultaSituacaoAtualCtg', dot: 'abr' },
  { id: 'vivo-mve', name: 'Vivo MVE', url: 'https://mve.vivo.com.br/oauth?logout=true', dot: 'vivo' },
  { id: 'vivo-cobertura', name: 'Vivo Cobertura', url: 'https://vivo.com.br/para-voce/por-que-vivo/qualidade/cobertura', dot: 'vivo' },
  { id: 'tim-negocia', name: 'TIM Negocia', url: 'https://timnegocia.com.br/', dot: 'tim' },
  { id: 'meu-tim', name: 'Meu TIM', url: 'https://meutim.tim.com.br/novo', dot: 'tim' },
  { id: 'claro-acesso', name: 'Minha Claro', url: 'https://minhaclaro.claro.com.br/acesso-rapido/', dot: 'claro' },
  { id: 'claro-cobertura', name: 'Claro Cobertura', url: 'https://www.claro.com.br/mapa-de-cobertura?srsltid=AfmBOoo6nyH43Cy_Tmy1RbxKaKLlpmftwCGEshrnN4FZz__aZVj2NppU', dot: 'claro' },
];
