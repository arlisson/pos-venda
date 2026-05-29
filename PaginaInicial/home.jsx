// === Home Page (Início) ===
// Metas DIÁRIAS — recompensa é surpresa até o resgate
const REWARD_GOALS = [
  { id: 'g1', target: 3, metric: 'vendas_dia', reward: 'Vale-café R$ 20', icon: '🎁' },
  { id: 'g2', target: 5, metric: 'vendas_dia', reward: 'Vale R$ 50', icon: '🎁' },
  { id: 'g3', target: 1500, metric: 'valor_dia', reward: 'Vale-jantar R$ 80', icon: '🎁' },
  { id: 'g4', target: 3, metric: 'concluidas_dia', reward: '1h de saída antecipada', icon: '🎁' },
  { id: 'g5', target: 3000, metric: 'valor_dia', reward: 'Bônus de R$ 150', icon: '🎁' },
];

const METRIC_LABEL = {
  vendas_dia: { label: 'vendas no dia', short: 'vendas', fmt: (n) => `${n}` },
  valor_dia: { label: 'em vendas no dia', short: 'em vendas', fmt: (n) => formatBRL(n) },
  concluidas_dia: { label: 'concluídas no dia', short: 'concluídas', fmt: (n) => `${n}` },
};

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function computeProgress(sales) {
  const today = sales.filter(s => isToday(s.created));
  const vendasDia = today.length;
  const valorDia = today.reduce((s, x) => s + x.value, 0);
  const concluidasDia = today.filter(s => s.stage === 'concluido').length;
  return REWARD_GOALS.map(g => {
    let current = 0;
    if (g.metric === 'vendas_dia') current = vendasDia;
    if (g.metric === 'valor_dia') current = valorDia;
    if (g.metric === 'concluidas_dia') current = concluidasDia;
    const pct = Math.min(100, (current / g.target) * 100);
    return { ...g, current, pct, achieved: pct >= 100 };
  });
}

function goalTitle(g) {
  const m = METRIC_LABEL[g.metric];
  return `${m.fmt(g.target)} ${m.label}`;
}

// Mock data para vendas com problema (pendências em andamento)
const PROBLEM_SALES = [
  {
    id: 'VND-2207',
    client: 'Felipe Cardoso',
    doc: '482.337.991-04',
    operator: 'Vivo',
    plan: 'Controle 20GB',
    value: 89.90,
    iccid: '8955010012345678901',
    line: '(11) 98821-4477',
    address: 'Rua Augusta, 1820 - São Paulo/SP',
    seller: { id: 'rl', name: 'Rafael Lima', initials: 'RL' },
    stage: 'retorno',
    created: new Date(Date.now() - 5 * 86400000),
    updated: new Date(Date.now() - 2 * 86400000),
    notes: '',
    returnReason: 'Aguardando envio de comprovante de endereço pelo cliente',
    problemType: 'Aguardando documento',
    history: [
      { stage: 'criado', title: 'Venda lançada no sistema', when: new Date(Date.now() - 5 * 86400000), who: 'Rafael Lima' },
      { stage: 'aprovacao', title: 'Movido para Aprovação', when: new Date(Date.now() - 4 * 86400000), who: 'Pós-venda' },
      { kind: 'system', stage: 'retorno', title: 'Pendência aberta', when: new Date(Date.now() - 2 * 86400000), who: 'Sistema', note: 'Comprovante de endereço não anexado — operadora exige para finalizar aprovação.' },
    ],
  },
  {
    id: 'VND-2241',
    client: 'Patrícia Mendes',
    doc: '687.224.330-17',
    operator: 'TIM',
    plan: 'Pós 40GB',
    value: 149.90,
    iccid: '8955010098765432109',
    line: '(11) 99440-3382',
    address: 'Av. Faria Lima, 3477 - São Paulo/SP',
    seller: { id: 'jp', name: 'João Pedro Alves', initials: 'JP' },
    stage: 'retorno',
    created: new Date(Date.now() - 3 * 86400000),
    updated: new Date(Date.now() - 1 * 86400000),
    notes: '',
    returnReason: 'Erro na ativação do chip — sistema da TIM retornou código E-204',
    problemType: 'Erro na ativação',
    history: [
      { stage: 'criado', title: 'Venda lançada no sistema', when: new Date(Date.now() - 3 * 86400000), who: 'João Pedro Alves' },
      { stage: 'aprovacao', title: 'Aprovação concluída', when: new Date(Date.now() - 2 * 86400000), who: 'Pós-venda' },
      { kind: 'system', stage: 'ativacao', title: 'Tentativa de ativação falhou', when: new Date(Date.now() - 1 * 86400000), who: 'Sistema', note: 'Erro E-204 retornado pela operadora TIM. Necessário contato com suporte.' },
    ],
  },
];

// Mock de ligações marcadas (callbacks agendados)
const LIGACOES_MARCADAS = [
  { id: 'L-001', client: 'Júlio César Macedo', doc: '442.881.557-66', operator: 'Vivo', plan: 'Controle 20GB', when: new Date(Date.now() - 3 * 3600000), reason: 'Cliente pediu retorno para confirmar fechamento da venda', value: 89.90, line: '(11) 99023-4451' },
  { id: 'L-002', client: 'Loja Bella Casa', doc: '34.881.557/0001-67', operator: 'TIM', plan: 'Pós Empresarial 100GB', when: new Date(Date.now() + 2 * 3600000), reason: 'Apresentar proposta de migração corporativa', value: 299.90, line: '(11) 98221-9930' },
  { id: 'L-003', client: 'Lucas Mendes Ribeiro', doc: '776.221.554-30', operator: 'Claro', plan: 'Pós 40GB', when: new Date(Date.now() - 6 * 3600000), reason: 'Cliente ficou de pensar — retornar para fechar', value: 139.90, line: '(11) 99440-2208' },
];

// Mock de vendas paradas (sem movimento há +5 dias)
const VENDAS_PARADAS = [
  { id: 'VND-1840', client: 'Construtora Lince Sul', doc: '08.554.221/0001-19', operator: 'Vivo', plan: 'Pós Empresarial 100GB', daysStalled: 7, stage: 'aprovacao', value: 299.90, line: '(11) 99002-1145', reason: 'Aguardando análise de crédito da operadora há 7 dias' },
  { id: 'VND-1855', client: 'Floricultura Jardim das Flores', doc: '18.665.770/0001-42', operator: 'TIM', plan: 'Controle 20GB', daysStalled: 9, stage: 'envio', value: 89.90, line: '(11) 98221-7740', reason: 'Chip em separação na logística — sem movimentação' },
];

// Mock de fidelidades vencendo (escalável)
const FIDELIDADE_ITEMS = [
  { id: 'F-001', client: 'Marina Albuquerque', doc: '337.221.998-04', operator: 'Vivo', plan: 'Pós 30GB', daysLeft: 3, value: 119.90, line: '(11) 99831-2204' },
  { id: 'F-002', client: 'Roberto Lima', doc: '128.554.881-22', operator: 'TIM', plan: 'Pós 50GB', daysLeft: 7, value: 169.90, line: '(11) 98712-3320' },
  { id: 'F-003', client: 'Sandra Nunes', doc: '441.118.227-50', operator: 'Claro', plan: 'Pós 25GB', daysLeft: 14, value: 99.90, line: '(11) 99001-2348' },
  { id: 'F-004', client: 'Eduardo Vasquez', doc: '775.221.443-82', operator: 'Vivo', plan: 'Pós 40GB', daysLeft: 18, value: 139.90, line: '(11) 99445-8821' },
  { id: 'F-005', client: 'Carolina Brito', doc: '887.554.221-66', operator: 'TIM', plan: 'Controle 20GB', daysLeft: 21, value: 89.90, line: '(11) 98223-7741' },
  { id: 'F-006', client: 'Tiago Mascarenhas', doc: '321.778.412-08', operator: 'Claro', plan: 'Pós Empresarial 100GB', daysLeft: 24, value: 299.90, line: '(11) 99220-1144' },
  { id: 'F-007', client: 'Helena Cordeiro', doc: '551.224.778-31', operator: 'Vivo', plan: 'Controle 8GB', daysLeft: 28, value: 59.90, line: '(11) 98114-2207' },
  { id: 'F-008', client: 'Andrea Furtado', doc: '443.118.227-50', operator: 'TIM', plan: 'Pós 40GB', daysLeft: 4, value: 139.90, line: '(11) 99441-3782' },
  { id: 'F-009', client: 'Vinícius Santiago', doc: '029.443.118-22', operator: 'Vivo', plan: 'Pós 40GB', daysLeft: 9, value: 139.90, line: '(11) 99002-8821' },
  { id: 'F-010', client: 'Patrícia Lobo', doc: '118.227.550-44', operator: 'Claro', plan: 'Controle 20GB', daysLeft: 16, value: 89.90, line: '(11) 98774-2030' },
  { id: 'F-011', client: 'Ricardo Mauad', doc: '227.550-441-18', operator: 'Vivo', plan: 'Pós Empresarial 100GB', daysLeft: 26, value: 299.90, line: '(11) 99551-2208' },
  { id: 'F-012', client: 'Beatriz Faleiro', doc: '550.441.118-22', operator: 'TIM', plan: 'Pós 30GB', daysLeft: 12, value: 119.90, line: '(11) 99003-7714' },
];

// Constrói itens unificados da caixa de pendências
function buildInboxItems(sales) {
  const items = [];
  // Retornos (críticos)
  sales.filter(s => s.stage === 'retorno').forEach(s => {
    items.push({
      id: `R-${s.id}`,
      type: 'retorno',
      severity: 'danger',
      urgency: 1, // mais crítico
      title: s.client,
      subtitle: s.returnReason || 'Sem descrição',
      operator: s.operator,
      plan: s.plan,
      value: s.value,
      when: s.updated,
      timeLabel: relTime(s.updated),
      action: 'Resolver',
      sale: s,
    });
  });
  // Vendas com problema (em andamento)
  PROBLEM_SALES.forEach(ps => {
    items.push({
      id: `P-${ps.id}`,
      type: 'problema',
      severity: 'info',
      urgency: 2,
      title: ps.client,
      subtitle: ps.returnReason,
      tag: ps.problemType,
      operator: ps.operator,
      plan: ps.plan,
      value: ps.value,
      when: ps.updated,
      timeLabel: relTime(ps.updated),
      action: 'Resolver',
      sale: ps,
    });
  });
  // Fidelidade
  FIDELIDADE_ITEMS.forEach(f => {
    items.push({
      id: `F-${f.id}`,
      type: 'fidelidade',
      severity: f.daysLeft <= 7 ? 'warn' : 'neutral',
      urgency: f.daysLeft <= 7 ? 2 : f.daysLeft <= 15 ? 3 : 4,
      title: f.client,
      subtitle: `${f.plan} · vence em ${f.daysLeft} ${f.daysLeft === 1 ? 'dia' : 'dias'}`,
      operator: f.operator,
      plan: f.plan,
      value: f.value,
      daysLeft: f.daysLeft,
      timeLabel: `Vence em ${f.daysLeft}d`,
      action: 'Renovar',
      fidelity: f,
    });
  });
  // Ligações marcadas (callbacks)
  LIGACOES_MARCADAS.forEach(l => {
    const isPast = l.when.getTime() < Date.now();
    items.push({
      id: `L-${l.id}`,
      type: 'ligacao',
      severity: isPast ? 'success-urgent' : 'success',
      urgency: isPast ? 1 : 2,
      title: l.client,
      subtitle: l.reason,
      operator: l.operator,
      plan: l.plan,
      value: l.value,
      when: l.when,
      timeLabel: isPast ? `Atrasada ${relTime(l.when)}` : `Em ${Math.ceil((l.when.getTime() - Date.now()) / 3600000)}h`,
      action: 'Ligar',
      ligacao: l,
    });
  });
  // Vendas paradas
  VENDAS_PARADAS.forEach(v => {
    items.push({
      id: `S-${v.id}`,
      type: 'parada',
      severity: 'purple',
      urgency: v.daysStalled >= 7 ? 1 : 2,
      title: v.client,
      subtitle: v.reason,
      operator: v.operator,
      plan: v.plan,
      value: v.value,
      daysStalled: v.daysStalled,
      timeLabel: `Parada ${v.daysStalled}d`,
      action: 'Destravar',
      parada: v,
    });
  });
  return items;
}

const INBOX_TYPE_META = {
  retorno: { label: 'Retorno', icon: 'AlertTriangle', color: 'danger' },
  problema: { label: 'Problema', icon: 'AlertCircle', color: 'info' },
  fidelidade: { label: 'Fidelidade', icon: 'Clock', color: 'warn' },
  ligacao: { label: 'Ligação', icon: 'Phone', color: 'success' },
  parada: { label: 'Venda parada', icon: 'Clock', color: 'purple' },
};

function urgencyTier(item) {
  if (item.urgency === 1) return { id: 'urgente', label: 'Urgente · ação imediata' };
  if (item.urgency === 2) return { id: 'semana', label: 'Esta semana' };
  if (item.urgency === 3) return { id: 'quinzena', label: 'Próximos 15 dias' };
  return { id: 'mes', label: 'Próximos 30 dias' };
}

function PendingInbox({ sales, onOpenProblem }) {
  const [activeType, setActiveType] = React.useState('todas');
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState('urgencia');

  const all = React.useMemo(() => buildInboxItems(sales), [sales]);

  const counts = {
    todas: all.length,
    retorno: all.filter(i => i.type === 'retorno').length,
    problema: all.filter(i => i.type === 'problema').length,
    fidelidade: all.filter(i => i.type === 'fidelidade').length,
    ligacao: all.filter(i => i.type === 'ligacao').length,
    parada: all.filter(i => i.type === 'parada').length,
  };

  let items = all;
  if (activeType !== 'todas') items = items.filter(i => i.type === activeType);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.subtitle.toLowerCase().includes(q) ||
      i.operator.toLowerCase().includes(q)
    );
  }
  if (sort === 'urgencia') items = [...items].sort((a, b) => a.urgency - b.urgency);
  else if (sort === 'valor') items = [...items].sort((a, b) => b.value - a.value);
  else if (sort === 'recente') items = [...items].sort((a, b) => (b.when?.getTime?.() || 0) - (a.when?.getTime?.() || 0));

  // Hero: top 3 most urgent (only when "Todas" + sort by urgency)
  const showHero = activeType === 'todas' && !query.trim() && sort === 'urgencia';
  const heroItems = showHero ? items.slice(0, 3) : [];
  const restItems = showHero ? items.slice(3) : items;

  const valorEmRisco = all.reduce((s, x) => s + (x.type === 'retorno' ? x.value : 0), 0);
  const urgentCount = all.filter(i => i.urgency === 1).length;

  const handleOpen = (it) => {
    if (!onOpenProblem) return;
    if (it.sale) onOpenProblem(it.sale);
    else if (it.fidelity) {
      const f = it.fidelity;
      const today = new Date();
      onOpenProblem({
        id: f.id, client: f.client, doc: f.doc, operator: f.operator, plan: f.plan, value: f.value,
        iccid: '—', line: f.line, address: 'Endereço cadastrado na operadora',
        seller: { id: 'cs', name: 'Camila Souza', initials: 'CS' },
        stage: 'retorno',
        created: new Date(today.getTime() - 365 * 86400000),
        updated: new Date(today.getTime() - (30 - f.daysLeft) * 86400000),
        notes: '',
        returnReason: `Fidelidade vence em ${f.daysLeft} ${f.daysLeft === 1 ? 'dia' : 'dias'} — oportunidade de renovação`,
        history: [
          { stage: 'criado', title: 'Cliente ativo desde', when: new Date(today.getTime() - 365 * 86400000), who: 'Sistema' },
          { kind: 'system', stage: 'retorno', title: 'Fidelidade próxima do fim', when: new Date(), who: 'Sistema', note: `Plano ${f.plan} — fidelidade vence em ${f.daysLeft} dias.` },
        ],
      });
    } else if (it.ligacao) {
      const l = it.ligacao;
      const isPast = l.when.getTime() < Date.now();
      onOpenProblem({
        id: l.id, client: l.client, doc: l.doc, operator: l.operator, plan: l.plan, value: l.value,
        iccid: '—', line: l.line, address: '—',
        seller: { id: 'cs', name: 'Camila Souza', initials: 'CS' },
        stage: 'retorno',
        created: new Date(l.when.getTime() - 2 * 86400000),
        updated: l.when,
        notes: '',
        returnReason: `Ligação agendada — ${l.reason}`,
        history: [
          { stage: 'criado', title: 'Lead criado', when: new Date(l.when.getTime() - 2 * 86400000), who: 'Camila Souza' },
          { kind: 'system', stage: 'retorno', title: isPast ? 'Ligação em atraso' : 'Ligação agendada', when: l.when, who: 'Sistema', note: l.reason },
        ],
      });
    } else if (it.parada) {
      const v = it.parada;
      onOpenProblem({
        id: v.id, client: v.client, doc: v.doc, operator: v.operator, plan: v.plan, value: v.value,
        iccid: '—', line: v.line, address: '—',
        seller: { id: 'cs', name: 'Camila Souza', initials: 'CS' },
        stage: 'retorno',
        created: new Date(Date.now() - (v.daysStalled + 5) * 86400000),
        updated: new Date(Date.now() - v.daysStalled * 86400000),
        notes: '',
        returnReason: `Venda parada há ${v.daysStalled} dias — ${v.reason}`,
        history: [
          { stage: 'criado', title: 'Venda lançada', when: new Date(Date.now() - (v.daysStalled + 5) * 86400000), who: 'Camila Souza' },
          { kind: 'system', stage: 'retorno', title: 'Sem movimentação', when: new Date(Date.now() - v.daysStalled * 86400000), who: 'Sistema', note: v.reason },
        ],
      });
    }
  };

  return (
    <div className="pendencias">
      {/* Title strip with KPI bar */}
      <div className="pend-headline">
        <div className="pend-headline-text">
          <h2 className="pend-title">Pendências</h2>
          {urgentCount > 0 ? (
            <div className="pend-urgent-banner">
              <span className="banner-icon">
                <I.AlertTriangle size={14} stroke="white" />
              </span>
              <span>
                <strong>{urgentCount} {urgentCount === 1 ? 'pendência precisa' : 'pendências precisam'}</strong> de ação imediata
              </span>
            </div>
          ) : (
            <div className="pend-subtitle">Tudo em dia por aqui ✓</div>
          )}
        </div>
        <div className="pend-stats">
          {(() => {
            const urgentRetorno = all.filter(i => i.type === 'retorno' && i.urgency === 1).length;
            const urgentLigacao = LIGACOES_MARCADAS.filter(l => l.when.getTime() < Date.now()).length;
            const urgentFid = FIDELIDADE_ITEMS.filter(f => f.daysLeft <= 7).length;
            const urgentParada = VENDAS_PARADAS.filter(v => v.daysStalled >= 7).length;
            return null;
          })()}
          <button
            className={`pend-stat danger ${activeType === 'retorno' ? 'active' : ''} ${counts.retorno > 0 ? 'attn' : 'zero'}`}
            onClick={() => setActiveType(activeType === 'retorno' ? 'todas' : 'retorno')}
          >
            <div className="stat-top">
              <span className="stat-num">{counts.retorno}</span>
              <span className="stat-icon"><I.AlertTriangle size={18} /></span>
            </div>
            <div>
              <div className="stat-label">Retornos</div>
              <div className={`stat-sub ${counts.retorno > 0 ? 'alarm' : ''}`}>
                {counts.retorno > 0 ? `${formatBRL(valorEmRisco)} em risco` : 'Sem retornos'}
              </div>
            </div>
          </button>
          <button
            className={`pend-stat warn ${activeType === 'fidelidade' ? 'active' : ''} ${counts.fidelidade > 0 ? 'attn' : 'zero'}`}
            onClick={() => setActiveType(activeType === 'fidelidade' ? 'todas' : 'fidelidade')}
          >
            <div className="stat-top">
              <span className="stat-num">{counts.fidelidade}</span>
              <span className="stat-icon"><I.Clock size={18} /></span>
            </div>
            <div>
              <div className="stat-label">Fim de fidelidade</div>
              <div className={`stat-sub ${FIDELIDADE_ITEMS.filter(f => f.daysLeft <= 7).length > 0 ? 'alarm' : ''}`}>
                {FIDELIDADE_ITEMS.filter(f => f.daysLeft <= 7).length > 0
                  ? `${FIDELIDADE_ITEMS.filter(f => f.daysLeft <= 7).length} esta semana`
                  : 'Nenhuma esta semana'}
              </div>
            </div>
          </button>
          <button
            className={`pend-stat success ${activeType === 'ligacao' ? 'active' : ''} ${counts.ligacao > 0 ? 'attn' : 'zero'}`}
            onClick={() => setActiveType(activeType === 'ligacao' ? 'todas' : 'ligacao')}
          >
            <div className="stat-top">
              <span className="stat-num">{counts.ligacao}</span>
              <span className="stat-icon"><I.Phone size={18} /></span>
            </div>
            <div>
              <div className="stat-label">Ligações marcadas</div>
              <div className={`stat-sub ${LIGACOES_MARCADAS.filter(l => l.when.getTime() < Date.now()).length > 0 ? 'alarm' : ''}`}>
                {LIGACOES_MARCADAS.filter(l => l.when.getTime() < Date.now()).length > 0
                  ? `${LIGACOES_MARCADAS.filter(l => l.when.getTime() < Date.now()).length} em atraso`
                  : counts.ligacao > 0 ? 'No prazo' : 'Sem ligações'}
              </div>
            </div>
          </button>
          <button
            className={`pend-stat purple ${activeType === 'parada' ? 'active' : ''} ${counts.parada > 0 ? 'attn' : 'zero'}`}
            onClick={() => setActiveType(activeType === 'parada' ? 'todas' : 'parada')}
          >
            <div className="stat-top">
              <span className="stat-num">{counts.parada}</span>
              <span className="stat-icon"><I.Clock size={18} /></span>
            </div>
            <div>
              <div className="stat-label">Vendas paradas</div>
              <div className={`stat-sub ${counts.parada > 0 ? 'alarm' : ''}`}>
                {counts.parada > 0 ? 'Mais de 5 dias' : 'Tudo fluindo'}
              </div>
            </div>
          </button>
          <button
            className={`pend-stat info ${activeType === 'problema' ? 'active' : ''} ${counts.problema > 0 ? 'attn' : 'zero'}`}
            onClick={() => setActiveType(activeType === 'problema' ? 'todas' : 'problema')}
          >
            <div className="stat-top">
              <span className="stat-num">{counts.problema}</span>
              <span className="stat-icon"><I.AlertCircle size={18} /></span>
            </div>
            <div>
              <div className="stat-label">Vendas com problema</div>
              <div className={`stat-sub ${counts.problema > 0 ? 'alarm' : ''}`}>
                {counts.problema > 0 ? 'Precisam de ação' : 'Sem problemas'}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Hero — top 3 mais urgentes */}
      {heroItems.length > 0 && (
        <div className="pend-hero">
          <div className="pend-section-title">
            <span className="pend-section-dot danger"></span>
            Ação imediata
            <span className="muted-count">{heroItems.length}</span>
          </div>
          <div className="hero-grid">
            {heroItems.map(it => {
              const meta = INBOX_TYPE_META[it.type];
              const Icon = I[meta.icon];
              return (
                <button key={it.id} className={`hero-card ${it.severity}`} onClick={() => handleOpen(it)}>
                  <div className="hero-card-top">
                    <span className={`hero-type-chip tag-${meta.color}`}>
                      <Icon size={11} /> {meta.label}
                    </span>
                    <span className="hero-time">{it.timeLabel}</span>
                  </div>
                  <div className="hero-card-body">
                    <div className="hero-client">{it.title}</div>
                    <div className="hero-reason">{it.subtitle}</div>
                  </div>
                  <div className="hero-card-bottom">
                    <div className="hero-meta">
                      <span className="hero-operator">{it.operator}</span>
                      <span className={`hero-value ${it.severity}`}>
                        {it.type === 'retorno' ? '−' : ''}{formatBRL(it.value)}
                      </span>
                    </div>
                    <span className="hero-cta">
                      {it.action} <I.ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List section */}
      <div className="pend-list-section">
        <div className="pend-list-header">
          <div className="pend-section-title">
            <span className="pend-section-dot"></span>
            {showHero ? 'Demais pendências' : 'Resultados'}
            <span className="muted-count">{restItems.length}</span>
          </div>
          <div className="pend-list-controls">
            <div className="pend-search">
              <I.Search size={13} />
              <input
                placeholder="Buscar…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && <button className="clear-x" onClick={() => setQuery('')}><I.Close size={11} /></button>}
            </div>
            <select className="pend-sort" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="urgencia">Urgência</option>
              <option value="recente">Recente</option>
              <option value="valor">Valor</option>
            </select>
          </div>
        </div>

        {activeType !== 'todas' && (
          <div className="active-filter">
            Filtrando por <strong>{INBOX_TYPE_META[activeType]?.label || activeType}</strong>
            <button className="clear-filter" onClick={() => setActiveType('todas')}>
              <I.Close size={10} /> Limpar
            </button>
          </div>
        )}

        <div className="pend-list">
          {restItems.length === 0 && (
            <div className="pend-empty">
              <div className="empty-icon">✓</div>
              <div className="empty-title">Nada por aqui</div>
              <div className="empty-sub">{query ? 'Tente outro termo.' : 'Tudo em dia.'}</div>
            </div>
          )}
          {restItems.slice(0, 8).map(it => {
            const meta = INBOX_TYPE_META[it.type];
            const Icon = I[meta.icon];
            return (
              <button key={it.id} className={`pend-row ${it.severity}`} onClick={() => handleOpen(it)}>
                <span className={`pend-row-marker tag-${meta.color}`}>
                  <Icon size={11} />
                </span>
                <span className="pend-row-main">
                  <span className="pend-row-title">{it.title}</span>
                  <span className="pend-row-sub">
                    <span className={`pend-row-type tag-${meta.color}`}>{meta.label}</span>
                    <span className="pend-row-dot">·</span>
                    {it.subtitle}
                  </span>
                </span>
                <span className="pend-row-side">
                  <span className={`pend-row-value ${it.severity}`}>
                    {it.type === 'retorno' ? '−' : ''}{formatBRL(it.value)}
                  </span>
                  <span className="pend-row-time">{it.timeLabel}</span>
                </span>
                <span className="pend-row-chev">
                  <I.ArrowRight size={13} />
                </span>
              </button>
            );
          })}
          {restItems.length > 8 && (
            <div className="pend-more">
              <span>+{restItems.length - 8} {restItems.length - 8 === 1 ? 'pendência' : 'pendências'}</span>
              <button className="pend-more-btn">Ver todas <I.ArrowRight size={12} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomePage({ sales, onGoReturns, onNewSale, onOpenProblem, claimed, onClaim }) {
  const returns = sales.filter(s => s.stage === 'retorno');
  const returnsValue = returns.reduce((s, x) => s + x.value, 0);
  const goals = computeProgress(sales);

  // Hoje
  const today = sales.filter(s => isToday(s.created));
  const vendasDia = today.length;
  const valorDia = today.reduce((s, x) => s + x.value, 0);
  const concluidasDia = today.filter(s => s.stage === 'concluido').length;

  // Mês
  const valorPipeline = sales.filter(s => s.stage !== 'retorno' && s.stage !== 'concluido').reduce((s, x) => s + x.value, 0);

  return (
    <div className="home">
      {/* Saudação */}
      <div className="home-greeting">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Bem-vinda, Camila 👋</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '4px 0 0' }}>
            Hoje é {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.
          </p>
        </div>
      </div>

      {/* Caixa de pendências unificada */}
      <PendingInbox sales={sales} onOpenProblem={onOpenProblem} />

      {/* (Legado — ocultado) */}
      <div className="notif-columns" style={{ display: 'none' }}>
        {/* Retornos */}
        <div className="notif-col danger">
          <div className="notif-col-header">
            <div className="notif-col-icon"><I.AlertTriangle size={16} /></div>
            <div className="notif-col-title-wrap">
              <div className="notif-col-title">Retornos</div>
              <div className="notif-col-sub">Chips devolvidos</div>
            </div>
            <div className="notif-col-count">{returns.length}</div>
          </div>
          <div className="notif-col-body">
            {returns.length === 0 && <div className="notif-empty">Sem retornos no momento 🎉</div>}
            {returns.slice(0, 3).map(s => (
              <div key={s.id} className="notif-item" onClick={onGoReturns}>
                <div className="notif-item-title">{s.client}</div>
                <div className="notif-item-sub">{s.operator} · {s.returnReason || 'Sem descrição'}</div>
                <div className="notif-item-meta"><span className="loss">−{formatBRL(s.value)}</span></div>
              </div>
            ))}
          </div>
          {returns.length > 0 && (
            <button className="notif-cta danger" onClick={onGoReturns}>
              Ver todos os retornos <I.ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* Fim de fidelidade */}
        <div className="notif-col warn">
          <div className="notif-col-header">
            <div className="notif-col-icon"><I.Clock size={16} /></div>
            <div className="notif-col-title-wrap">
              <div className="notif-col-title">Fim de fidelidade</div>
              <div className="notif-col-sub">Próximos 30 dias</div>
            </div>
            <div className="notif-col-count">4</div>
          </div>
          <div className="notif-col-body">
            <div className="notif-item">
              <div className="notif-item-title">Marina Albuquerque</div>
              <div className="notif-item-sub">Vivo · Plano Pós 30GB</div>
              <div className="notif-item-meta"><span className="warn-text">Vence em 5 dias</span></div>
            </div>
            <div className="notif-item">
              <div className="notif-item-title">Roberto Lima</div>
              <div className="notif-item-sub">TIM · Pós 50GB</div>
              <div className="notif-item-meta"><span className="warn-text">Vence em 12 dias</span></div>
            </div>
            <div className="notif-item">
              <div className="notif-item-title">Sandra Nunes</div>
              <div className="notif-item-sub">Claro · Pós 25GB</div>
              <div className="notif-item-meta"><span className="warn-text">Vence em 21 dias</span></div>
            </div>
          </div>
          <button className="notif-cta warn">
            Iniciar abordagem de renovação <I.ArrowRight size={13} />
          </button>
        </div>

        {/* Venda com problema */}
        <div className="notif-col info">
          <div className="notif-col-header">
            <div className="notif-col-icon"><I.AlertCircle size={16} /></div>
            <div className="notif-col-title-wrap">
              <div className="notif-col-title">Vendas com problema</div>
              <div className="notif-col-sub">Precisam de ação</div>
            </div>
            <div className="notif-col-count">{PROBLEM_SALES.length}</div>
          </div>
          <div className="notif-col-body">
            {PROBLEM_SALES.map(ps => {
              const days = Math.max(1, Math.floor((Date.now() - ps.updated.getTime()) / 86400000));
              return (
                <div key={ps.id} className="notif-item" onClick={() => onOpenProblem && onOpenProblem(ps)}>
                  <div className="notif-item-title">{ps.client}</div>
                  <div className="notif-item-sub">{ps.operator} · {ps.problemType}</div>
                  <div className="notif-item-meta"><span className="info-text">Pendência há {days} {days === 1 ? 'dia' : 'dias'}</span></div>
                </div>
              );
            })}
          </div>
          <button className="notif-cta info" onClick={() => onOpenProblem && onOpenProblem(PROBLEM_SALES[0])}>
            Resolver pendências <I.ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* KPIs do DIA */}
      <h2 className="home-section-title">Hoje</h2>
      <div className="stats-row">
        <div className="stat-card">
          <div className="label">Vendas no dia</div>
          <div className="value">{vendasDia}</div>
          <div className="delta">{today.length === 0 ? 'Nenhuma venda ainda' : 'Lançadas hoje'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Valor vendido hoje</div>
          <div className="value">{formatBRL(valorDia)}</div>
          <div className="delta">Soma das vendas do dia</div>
        </div>
        <div className="stat-card">
          <div className="label">Concluídas hoje</div>
          <div className="value">{concluidasDia}</div>
          <div className="delta">Fechadas no dia</div>
        </div>
        <div className="stat-card">
          <div className="label">Em pipeline</div>
          <div className="value">{formatBRL(valorPipeline)}</div>
          <div className="delta">Em andamento</div>
        </div>
      </div>

      {/* Sistema de recompensas DIÁRIAS */}
      <div className="rewards-header">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Metas de hoje</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '2px 0 0' }}>
            Bata cada meta para liberar uma recompensa surpresa. As metas reiniciam todo dia.
          </p>
        </div>
        <div className="rewards-progress-summary">
          <span className="muted" style={{ fontSize: 11.5 }}>Progresso do dia</span>
          <div className="progress-track" style={{ width: 160 }}>
            <div className="progress-fill" style={{ width: `${(goals.filter(g => g.achieved).length / goals.length) * 100}%` }}></div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>
            {goals.filter(g => g.achieved).length}/{goals.length}
          </span>
        </div>
      </div>

      <div className="rewards-grid">
        {goals.map((g, i) => {
          const isClaimed = claimed.includes(g.id);
          const m = METRIC_LABEL[g.metric];
          return (
            <div key={g.id} className={`reward-card ${g.achieved ? 'achieved' : ''} ${isClaimed ? 'claimed' : ''}`}>
              <div className="reward-top">
                <div className="reward-icon">{isClaimed ? '✅' : g.achieved ? '🎉' : g.icon}</div>
                <div className="reward-step">Meta {i + 1}</div>
                {g.achieved && !isClaimed && <span className="pill success" style={{ marginLeft: 'auto' }}><span className="pill-dot"></span>Disponível</span>}
                {isClaimed && <span className="pill" style={{ marginLeft: 'auto' }}><span className="pill-dot"></span>Resgatada</span>}
              </div>
              <div className="reward-name">{goalTitle(g)}</div>
              <div className="reward-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${g.pct}%`, background: g.achieved ? 'var(--success)' : 'var(--text)' }}></div>
                </div>
                <div className="reward-numbers">
                  <span>
                    {m.fmt(g.current)}
                    <span className="muted"> / {m.fmt(g.target)}</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(g.pct)}%</span>
                </div>
              </div>

              {/* Recompensa removida */}

              <button
                className={`btn ${g.achieved && !isClaimed ? 'btn-primary' : ''}`}
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                disabled={!g.achieved || isClaimed}
                onClick={() => onClaim(g.id)}
              >
                {isClaimed ? <><I.Check size={13} /> Resgatada</> : g.achieved ? 'Resgatar surpresa 🎁' : `Faltam ${m.fmt(Math.max(0, g.target - g.current))}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.HomePage = HomePage;
window.REWARD_GOALS = REWARD_GOALS;
window.computeProgress = computeProgress;
window.goalTitle = goalTitle;
