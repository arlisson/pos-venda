import { useState, useEffect } from 'react';
import * as I from '../Icons';
import { temPermissao } from '../../services/auth.service';
import { getMetas } from '../../services/meta.service';

function Sidebar({ page, setPage, counts, usuario, onLogout, onPerfilClick }) {
  const [metas, setMetas] = useState([]);

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);
  }, []);

  const items = [
    { id: 'dashboard', label: 'Início', icon: <I.Home />, permission: 'vendas' },
    { id: 'vendas', label: 'Vendas', icon: <I.Chart />, permission: ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir'] },
    { id: 'funil', label: 'Funil de vendas', icon: <I.Funnel />, badge: counts?.active, permission: 'vendas' },
    { id: 'retornos', label: 'Retornos', icon: <I.Return />, badge: counts?.returns, permission: 'vendas' },
    { id: 'historico', label: 'Histórico', icon: <I.History /> },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const admin = [
    { id: 'usuarios', label: 'Usuários', icon: <I.Users />, permission: ['crud_usuarios', 'usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'gerenciar_permissoes'] },
    { id: 'metas', label: 'Configurar Metas', icon: <I.Settings />, permission: 'crud_usuarios' },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const USER_PROGRESS = { clientes: 0, chips: 4, port_vivo: 0, port_claro: 2, negociacoes: 5, diaria: 8 };

  const giftMetas = metas.filter(m => m.is_gift);

  function medal(pct) {
    if (pct >= 100) return '🥇';
    if (pct >= 50)  return '🥈';
    if (pct >= 10)  return '🥉';
    return '⭐';
  }

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="sidebar-logo">
        <div className="logo-placeholder">POS VENDA</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length > 0 && (
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
        )}

        {admin.length > 0 && (
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
        )}
      </div>

      {/* Metas do Mês na Sidebar */}
      {giftMetas.length > 0 && (
        <div className="sidebar-metas">
          <div className="sidebar-metas-title">Metas do Mês</div>
          {giftMetas.map(meta => {
            const current = USER_PROGRESS[meta.tipo] || 0;
            const pct = Math.min(100, Math.round((current / meta.target) * 100));
            return (
              <div key={meta.id} className="sidebar-meta-item">
                <div className="sidebar-meta-top">
                  <span className="sidebar-meta-name">
                    <span>{medal(pct)}</span>
                    {meta.desc}
                  </span>
                  <span className="sidebar-meta-pct">{pct}%</span>
                </div>
                <div className="sidebar-meta-bar-bg">
                  <div
                    className={`sidebar-meta-bar-fill${pct >= 100 ? ' full' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="user-card">
          <button
            className="user-card-info"
            onClick={onPerfilClick}
            title="Editar perfil"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'inherit' }}
          >
            <div className="avatar" style={{ overflow: 'hidden' }}>
              {usuario?.foto_perfil ? (
                <img
                  src={usuario.foto_perfil}
                  alt={usuario?.nome || 'Foto de perfil'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                getInitials(usuario?.nome)
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{usuario?.nome || 'Usuario'}</div>
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
