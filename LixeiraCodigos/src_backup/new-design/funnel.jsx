// === Sale Card variants ===
function SaleCard({ sale, variant, onOpen, isReturn }) {
  const opClass = sale.operator.toLowerCase();
  if (variant === 'compact') {
    return (
      <div className={`sale-card compact ${isReturn ? 'return-card' : ''}`} onClick={() => onOpen(sale)}>
        <div className="sale-card-top">
          <div className="client">{sale.client}</div>
          <div className="value">{formatBRL(sale.value)}</div>
        </div>
        <div className="compact-meta">
          <span>{sale.operator}</span>
          <span>·</span>
          <span>{sale.id}</span>
        </div>
      </div>
    );
  }
  if (variant === 'detailed') {
    return (
      <div className={`sale-card detailed ${isReturn ? 'return-card' : ''}`} onClick={() => onOpen(sale)}>
        <div className="sale-card-top">
          <div className="client">{sale.client}</div>
          <div className="value">{formatBRL(sale.value)}</div>
        </div>
        <div className="sale-card-meta">
          <span className="operator">{sale.operator}</span>
          <span className="iccid">ICCID …{sale.iccid.slice(-6)}</span>
        </div>
        <div className="detail-row">
          <span className="label">Plano</span>
          <span>{sale.plan}</span>
        </div>
        <div className="detail-row">
          <span className="label">Vendedor</span>
          <span>{sale.seller.name}</span>
        </div>
        <div className="sale-card-bottom">
          <span>{sale.id}</span>
          <span>{relTime(sale.updated)}</span>
        </div>
        {isReturn && sale.returnReason && (
          <div className="detail-row" style={{ color: 'var(--danger)' }}>
            <span className="label">Motivo</span>
            <span>{sale.returnReason}</span>
          </div>
        )}
      </div>
    );
  }
  // standard
  return (
    <div className={`sale-card ${isReturn ? 'return-card' : ''}`} onClick={() => onOpen(sale)}>
      <div className="sale-card-top">
        <div className="client">{sale.client}</div>
        <div className="value">{formatBRL(sale.value)}</div>
      </div>
      <div className="sale-card-meta">
        <span className="operator">{sale.operator}</span>
        <span>·</span>
        <span>{sale.plan}</span>
      </div>
      <div className="sale-card-bottom">
        <span className="seller">
          <span className="mini-avatar">{sale.seller.initials}</span>
          <span>{sale.id}</span>
        </span>
        <span>{relTime(sale.updated)}</span>
      </div>
    </div>
  );
}

// === Kanban view ===
function KanbanView({ stages, sales, onOpen, cardVariant, returnMode }) {
  return (
    <div className="kanban">
      {stages.map(st => {
        const items = sales.filter(s => s.stage === st.id);
        const total = items.reduce((sum, s) => sum + s.value, 0);
        const isReturn = st.id === 'retorno';
        return (
          <div key={st.id} className="kanban-column">
            <div className="column-header">
              <div className="column-title-row">
                <span className={`column-dot ${st.dot}`}></span>
                <span className="column-name">{st.name}</span>
                <span className="column-count">{items.length}</span>
              </div>
              <div className={`column-total ${isReturn ? 'danger' : ''}`}>
                <span className="label">{isReturn ? 'Perda' : 'Total'}</span>
                <span className="value">{formatBRL(total)}</span>
              </div>
            </div>
            <div className="column-body">
              {items.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Nenhuma venda</div>
              )}
              {items.map(s => (
                <SaleCard key={s.id} sale={s} variant={cardVariant} onOpen={onOpen} isReturn={isReturn} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === List view ===
function ListView({ sales, onOpen, returnMode }) {
  return (
    <div className="list-table">
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Operadora</th>
              <th>Plano</th>
              <th>Vendedor</th>
              <th>Fase</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Atualizada</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(s => {
              const stage = (returnMode ? RETURN_STAGES : STAGES).find(x => x.id === s.stage);
              return (
                <tr key={s.id} onClick={() => onOpen(s)}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.id}</td>
                  <td>{s.client}</td>
                  <td>{s.operator}</td>
                  <td className="muted">{s.plan}</td>
                  <td>
                    <span className="seller" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mini-avatar">{s.seller.initials}</span>
                      {s.seller.name}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${s.stage === 'concluido' ? 'success' : s.stage === 'retorno' ? 'danger' : ''}`}>
                      <span className="pill-dot"></span>
                      {stage ? stage.name : s.stage}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{formatBRL(s.value)}</td>
                  <td className="muted">{relTime(s.updated)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// === Hybrid view ===
function HybridView({ stages, sales, onOpen, cardVariant }) {
  const [activeStage, setActiveStage] = React.useState(stages[0].id);
  const items = sales.filter(s => s.stage === activeStage);
  const stage = stages.find(s => s.id === activeStage);
  const total = items.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="hybrid">
      <div className="hybrid-rail">
        {stages.map(st => {
          const stItems = sales.filter(s => s.stage === st.id);
          const stTotal = stItems.reduce((sum, s) => sum + s.value, 0);
          return (
            <div key={st.id} className={`hybrid-rail-item ${activeStage === st.id ? 'active' : ''}`} onClick={() => setActiveStage(st.id)}>
              <div className="top">
                <span className={`column-dot ${st.dot}`}></span>
                <span className="name">{st.name}</span>
                <span className="column-count">{stItems.length}</span>
              </div>
              <div className="meta">
                <span>Total</span>
                <span className="total">{formatBRL(stTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hybrid-detail">
        <div className="hybrid-detail-header">
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{stage.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{items.length} venda(s) · {formatBRL(total)}</div>
          </div>
        </div>
        <div className="hybrid-detail-body">
          {items.map(s => (
            <SaleCard key={s.id} sale={s} variant={cardVariant} onOpen={onOpen} isReturn={s.stage === 'retorno'} />
          ))}
        </div>
      </div>
    </div>
  );
}

window.SaleCard = SaleCard;
window.KanbanView = KanbanView;
window.ListView = ListView;
window.HybridView = HybridView;
