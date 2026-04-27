import React from 'react';
import * as I from '../Icons';

function Sidebar({ page, setPage, counts, usuario, onLogout, onPerfilClick }) {
  const items = [
    { id: 'funil', label: 'Funil de vendas', icon: <I.Funnel />, badge: counts?.active },
    { id: 'retornos', label: 'Retornos', icon: <I.Return />, badge: counts?.returns },
    { id: 'dashboard', label: 'Relatórios', icon: <I.Chart /> },
    { id: 'historico', label: 'Histórico', icon: <I.History /> },
  ];
  const admin = [
    { id: 'usuarios', label: 'Usuários', icon: <I.Users /> },
    { id: 'config', label: 'Configurações', icon: <I.Settings /> },
  ];

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-placeholder">POS VENDA</div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Operação</div>
        {items.map(it => (
          <button 
            key={it.id} 
            className={`nav-item ${page === it.id ? 'active' : ''}`} 
            onClick={() => setPage(it.id)}
          >
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
            {it.badge != null && it.badge > 0 && <span className="badge">{it.badge}</span>}
          </button>
        ))}
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-title">Administração</div>
        {admin.map(it => (
          <button 
            key={it.id} 
            className={`nav-item ${page === it.id ? 'active' : ''}`} 
            onClick={() => setPage(it.id)}
          >
            <span className="icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="user-card">
          <button
            className="user-card-info"
            onClick={onPerfilClick}
            title="Editar perfil"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'inherit' }}
          >
            <div className="avatar">{getInitials(usuario?.nome)}</div>
            <div className="user-info">
              <div className="user-name">{usuario?.nome || 'Usuário'}</div>
              <div className="user-role">{usuario?.role?.nome || 'Perfil'}</div>
            </div>
          </button>
          <button
            className="btn-icon btn-ghost"
            title="Sair"
            onClick={onLogout}
          >
            <I.Logout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
