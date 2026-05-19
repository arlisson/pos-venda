// === Sidebar ===
function Sidebar({ page, setPage, counts }) {
  const items = [
    { id: 'funil', label: 'Funil de vendas', icon: <I.Funnel />, badge: counts.active },
    { id: 'retornos', label: 'Retornos', icon: <I.Return />, badge: counts.returns },
    { id: 'dashboard', label: 'Relatórios', icon: <I.Chart /> },
    { id: 'historico', label: 'Histórico', icon: <I.History /> },
  ];
  const admin = [
    { id: 'usuarios', label: 'Usuários', icon: <I.Users /> },
    { id: 'config', label: 'Configurações', icon: <I.Settings /> },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-placeholder">SUA LOGO AQUI</div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Operação</div>
        {items.map(it => (
          <button key={it.id} className={`nav-item ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
            {it.badge != null && <span className="badge">{it.badge}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Administração</div>
        {admin.map(it => (
          <button key={it.id} className={`nav-item ${page === it.id ? 'active' : ''}`} onClick={() => setPage(it.id)}>
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="avatar">CS</div>
          <div className="user-info">
            <div className="user-name">Camila Souza</div>
            <div className="user-role">Administradora</div>
          </div>
          <button className="btn-icon btn-ghost" title="Sair" onClick={() => window.__logout && window.__logout()}>
            <I.Logout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// === Header ===
function Header({ title, subtitle, onNew }) {
  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      <div className="external-links" style={{ marginLeft: 'auto' }}>
        {EXTERNAL_LINKS.map(l => (
          <a key={l.id} href={l.url} target="_blank" rel="noopener" className="external-link" title={`Abrir ${l.name}`}>
            <span className={`dot ${l.dot}`}></span>
            <span>{l.name}</span>
            <I.External size={11} style={{ opacity: 0.5 }} />
          </a>
        ))}
      </div>
      <div className="header-actions">
        <div className="search-box">
          <I.Search size={14} />
          <input placeholder="Buscar venda, cliente, ICCID…" />
        </div>
        <button className="btn btn-icon btn-ghost" title="Notificações">
          <I.Bell size={15} />
        </button>
        {onNew && (
          <button className="btn btn-primary" onClick={onNew}>
            <I.Plus size={14} /> Nova venda
          </button>
        )}
      </div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.Header = Header;
