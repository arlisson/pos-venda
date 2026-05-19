// === Main App ===
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "funnel_layout": "kanban",
  "card_variant": "standard"
}/*EDITMODE-END*/;

function App() {
  const [logged, setLogged] = React.useState(true);
  const [page, setPage] = React.useState('funil');
  const [sales, setSales] = React.useState(INITIAL_SALES);
  const [openSale, setOpenSale] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const [filter, setFilter] = React.useState('todas');
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { window.__logout = () => setLogged(false); }, []);

  const updateSale = (s) => {
    setSales(prev => prev.map(x => x.id === s.id ? s : x));
    setOpenSale(s);
  };
  const createSale = (s) => {
    setSales(prev => [s, ...prev]);
    setShowNew(false);
  };

  const counts = {
    active: sales.filter(s => s.stage !== 'retorno').length,
    returns: sales.filter(s => s.stage === 'retorno').length,
  };

  let filtered = sales;
  if (filter !== 'todas') filtered = sales.filter(s => s.operator === filter);

  if (!logged) return <LoginPage onLogin={() => setLogged(true)} />;

  const titles = {
    funil: { title: 'Funil de vendas', sub: 'Acompanhe cada venda do lançamento até a conclusão' },
    retornos: { title: 'Retornos', sub: 'Chips que retornaram por algum erro' },
    dashboard: { title: 'Relatórios', sub: 'Indicadores e produtividade' },
    historico: { title: 'Histórico', sub: 'Todas as movimentações do sistema' },
    usuarios: { title: 'Usuários', sub: 'Gerencie acessos e permissões' },
    config: { title: 'Configurações', sub: 'Personalize o sistema' },
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} counts={counts} />
      <div className="main">
        <Header
          title={titles[page].title}
          subtitle={titles[page].sub}
          onNew={page === 'funil' || page === 'retornos' ? () => setShowNew(true) : null}
        />

        {page === 'funil' && (
          <FunnelPage
            stages={STAGES}
            sales={filtered.filter(s => s.stage !== 'retorno')}
            onOpen={setOpenSale}
            tweaks={tweaks}
            setTweak={setTweak}
            filter={filter}
            setFilter={setFilter}
          />
        )}

        {page === 'retornos' && (
          <FunnelPage
            stages={RETURN_STAGES}
            sales={filtered.filter(s => s.stage === 'retorno')}
            onOpen={setOpenSale}
            tweaks={tweaks}
            setTweak={setTweak}
            filter={filter}
            setFilter={setFilter}
            returnMode
          />
        )}

        {page === 'dashboard' && <Dashboard sales={sales} />}
        {page === 'historico' && <HistoryPage sales={sales} />}
        {page === 'usuarios' && <UsersPage />}
        {page === 'config' && <SettingsPage />}
      </div>

      {openSale && <SaleDetail sale={openSale} onClose={() => setOpenSale(null)} onUpdate={updateSale} />}
      {showNew && <NewSaleDrawer onClose={() => setShowNew(false)} onCreate={createSale} />}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout do funil">
          <TweakRadio
            value={tweaks.funnel_layout}
            onChange={v => setTweak('funnel_layout', v)}
            options={[
              { value: 'kanban', label: 'Kanban' },
              { value: 'lista', label: 'Lista' },
              { value: 'hibrido', label: 'Híbrido' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Estilo do card">
          <TweakRadio
            value={tweaks.card_variant}
            onChange={v => setTweak('card_variant', v)}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'standard', label: 'Padrão' },
              { value: 'detailed', label: 'Detalhado' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function FunnelPage({ stages, sales, onOpen, tweaks, filter, setFilter, returnMode }) {
  const layout = tweaks.funnel_layout;
  const variant = tweaks.card_variant;

  const totalAtivo = sales.reduce((s, x) => s + x.value, 0);
  const totalPerda = sales.filter(s => s.stage === 'retorno').reduce((s, x) => s + x.value, 0);

  return (
    <>
      <div className="filters">
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>Operadora:</span>
        {['todas', ...OPERATORS].map(op => (
          <button key={op} className={`filter-chip ${filter === op ? 'active' : ''}`} onClick={() => setFilter(op)}>
            {op === 'todas' ? 'Todas' : op}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
          <span className="muted">{sales.length} vendas</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span><span className="muted">Total: </span><strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBRL(totalAtivo)}</strong></span>
          {returnMode && totalPerda > 0 && (
            <>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span style={{ color: 'var(--danger)' }}><strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBRL(totalPerda)}</strong> em perda</span>
            </>
          )}
        </div>
      </div>

      {layout === 'kanban' && <KanbanView stages={stages} sales={sales} onOpen={onOpen} cardVariant={variant} />}
      {layout === 'lista' && <ListView sales={sales} onOpen={onOpen} returnMode={returnMode} />}
      {layout === 'hibrido' && <HybridView stages={stages} sales={sales} onOpen={onOpen} cardVariant={variant} />}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
