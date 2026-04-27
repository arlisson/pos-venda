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
  { id: 'gov', name: 'Receita Federal', url: 'https://www.gov.br/receitafederal/', dot: 'gov' },
  { id: 'vivo', name: 'Vivo Empresas', url: 'https://www.vivo.com.br/empresas/', dot: 'vivo' },
  { id: 'tim', name: 'TIM Empresas', url: 'https://www.tim.com.br/empresas/', dot: 'tim' },
  { id: 'claro', name: 'Claro Empresas', url: 'https://www.claro.com.br/empresas/', dot: 'claro' },
];
