// === Mock data + helpers ===
const STAGES = [
  { id: 'aprovacao', name: 'Aprovação', dot: 'aprovacao' },
  { id: 'ativacao', name: 'Ativação', dot: 'ativacao' },
  { id: 'envio', name: 'Envio / Logística', dot: 'envio' },
  { id: 'entrega', name: 'Entrega', dot: 'entrega' },
  { id: 'confirmacao', name: 'Confirmação do cliente', dot: 'confirmacao' },
  { id: 'concluido', name: 'Concluído', dot: 'concluido' },
];

const RETURN_STAGES = [
  { id: 'retorno', name: 'Retorno recebido', dot: 'retorno' },
];

const OPERATORS = ['Vivo', 'TIM', 'Claro'];
const PLANS = ['Controle 20GB', 'Pós 40GB', 'Pós Empresarial 100GB', 'Pré Recarga', 'Controle 8GB'];
const SELLERS = [
  { id: 'cs', name: 'Camila Souza', initials: 'CS' },
  { id: 'rl', name: 'Rafael Lima', initials: 'RL' },
  { id: 'jp', name: 'João Pedro Alves', initials: 'JP' },
  { id: 'mb', name: 'Mariana Borges', initials: 'MB' },
  { id: 'ts', name: 'Thiago Silveira', initials: 'TS' },
];

const CLIENTS = [
  { name: 'Auto Peças Andrade Ltda', doc: '32.554.881/0001-22' },
  { name: 'Maria Fernanda Costa', doc: '128.554.881-22' },
  { name: 'Padaria Pão de Cada Dia', doc: '47.221.330/0001-08' },
  { name: 'Carlos Henrique Pereira', doc: '044.182.776-90' },
  { name: 'Mercado Boa Compra', doc: '12.998.554/0001-71' },
  { name: 'Construtora Lince Sul', doc: '08.554.221/0001-19' },
  { name: 'Júlia Ribeiro Moreira', doc: '321.778.412-08' },
  { name: 'Transportadora RotaSul', doc: '21.665.443/0001-50' },
  { name: 'Loja Bella Casa', doc: '34.881.557/0001-67' },
  { name: 'Pedro Augusto Tavares', doc: '551.224.778-31' },
  { name: 'Floricultura Jardim das Flores', doc: '18.665.770/0001-42' },
  { name: 'Restaurante Sabor da Serra', doc: '29.443.881/0001-08' },
  { name: 'Roberto Tadeu Marinho', doc: '887.554.221-66' },
  { name: 'Ana Clara Damasceno', doc: '775.221.443-82' },
  { name: 'Oficina Mecânica Silva', doc: '11.224.337/0001-99' },
  { name: 'Bruno Henrique Dias', doc: '443.118.227-50' },
];

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDateBR(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function relTime(d) {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const dd = Math.floor(h / 24);
  return `${dd}d atrás`;
}
function genICCID(seed) {
  // 19-digit ICCID-ish
  let s = '8955010';
  let n = seed * 7919 + 13;
  for (let i = 0; i < 12; i++) {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    s += (n % 10).toString();
  }
  return s;
}

// Pseudo-random but deterministic dataset
function buildSales() {
  const sales = [];
  const seedRand = (n) => {
    let x = Math.sin(n) * 10000; return x - Math.floor(x);
  };
  let id = 1001;
  const stagesPlan = [
    { stage: 'aprovacao', count: 5 },
    { stage: 'ativacao', count: 4 },
    { stage: 'envio', count: 6 },
    { stage: 'entrega', count: 5 },
    { stage: 'confirmacao', count: 3 },
    { stage: 'concluido', count: 7 },
    { stage: 'retorno', count: 4 },
  ];
  let clientI = 0;
  for (const sp of stagesPlan) {
    for (let i = 0; i < sp.count; i++) {
      const r = seedRand(id);
      const client = CLIENTS[clientI % CLIENTS.length];
      clientI++;
      const op = OPERATORS[Math.floor(r * OPERATORS.length)];
      const plan = PLANS[Math.floor(seedRand(id + 1) * PLANS.length)];
      const seller = SELLERS[Math.floor(seedRand(id + 2) * SELLERS.length)];
      const value = Math.round((59 + r * 380) * 100) / 100;
      const daysAgo = Math.floor(seedRand(id + 3) * 30) + 1;
      const created = new Date(Date.now() - daysAgo * 86400000 - Math.floor(seedRand(id + 4) * 12) * 3600000);
      const updated = new Date(created.getTime() + Math.floor(seedRand(id + 5) * daysAgo) * 86400000);
      sales.push({
        id: `VND-${id}`,
        client: client.name,
        doc: client.doc,
        operator: op,
        plan,
        value,
        iccid: genICCID(id),
        line: `(11) 9${String(Math.floor(seedRand(id + 6) * 99999999)).padStart(8, '0')}`,
        address: ['Av. Paulista, 1000 - São Paulo/SP', 'Rua das Flores, 234 - Curitiba/PR', 'Av. Brasil, 4500 - Rio de Janeiro/RJ', 'Rua XV de Novembro, 78 - Porto Alegre/RS'][Math.floor(seedRand(id + 7) * 4)],
        seller,
        stage: sp.stage,
        created,
        updated,
        notes: '',
        returnReason: sp.stage === 'retorno' ? [
          'Endereço inválido — devolvido pelo Correios',
          'Cliente recusou recebimento',
          'Chip danificado durante transporte',
          'CPF reprovado na operadora',
        ][i % 4] : null,
        history: buildHistory(sp.stage, created, id),
      });
      id++;
    }
  }
  return sales;
}

function buildHistory(currentStage, created, seed) {
  const order = ['aprovacao', 'ativacao', 'envio', 'entrega', 'confirmacao', 'concluido'];
  const hist = [];
  let t = new Date(created);
  hist.push({ stage: 'criado', title: 'Venda lançada no sistema', when: new Date(t), who: 'Camila Souza' });
  if (currentStage === 'retorno') {
    hist.push({ stage: 'aprovacao', title: 'Aprovação concluída', when: new Date(t.getTime() + 86400000), who: 'Pós-venda' });
    hist.push({ stage: 'envio', title: 'Chip enviado', when: new Date(t.getTime() + 2 * 86400000), who: 'Logística' });
    hist.push({ stage: 'retorno', title: 'Chip retornou', when: new Date(t.getTime() + 5 * 86400000), who: 'Pós-venda', note: 'Endereço inválido — devolvido pelo Correios' });
    return hist;
  }
  const idx = order.indexOf(currentStage);
  for (let i = 0; i <= idx; i++) {
    t = new Date(t.getTime() + 86400000 * (1 + (seed + i) % 3));
    hist.push({
      stage: order[i],
      title: `Movido para ${STAGES.find(s => s.id === order[i]).name}`,
      when: new Date(t),
      who: ['Camila Souza', 'Pós-venda', 'Logística', 'Sistema'][i % 4],
    });
  }
  return hist;
}

const EXTERNAL_LINKS = [
  { id: 'gov', name: 'Receita Federal', url: 'https://www.gov.br/receitafederal/', dot: 'gov' },
  { id: 'vivo', name: 'Vivo Empresas', url: 'https://www.vivo.com.br/empresas/', dot: 'vivo' },
  { id: 'tim', name: 'TIM Empresas', url: 'https://www.tim.com.br/empresas/', dot: 'tim' },
  { id: 'claro', name: 'Claro Empresas', url: 'https://www.claro.com.br/empresas/', dot: 'claro' },
];

const INITIAL_SALES = buildSales();

Object.assign(window, { STAGES, RETURN_STAGES, OPERATORS, PLANS, SELLERS, CLIENTS, EXTERNAL_LINKS, INITIAL_SALES, formatBRL, formatDateBR, relTime });
