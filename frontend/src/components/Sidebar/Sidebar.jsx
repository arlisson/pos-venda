import { useEffect, useState } from 'react';
import * as I from '../Icons';
import { temPermissao } from '../../services/auth.service';
import { getMetas, getProgresso } from '../../services/meta.service';

function Sidebar({ page, setPage, counts, usuario, onLogout, onPerfilClick }) {
  const [metas, setMetas] = useState([]);
  const [progresso, setProgresso] = useState({});

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);
    getProgresso().then(setProgresso).catch(console.error);
  }, []);

  const items = [
    { id: 'dashboard', label: 'Inicio', icon: <I.Home /> },
    { id: 'vendas', label: 'Vendas', icon: <I.Chart />, permission: ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir'] },
    { id: 'clientes', label: 'Clientes', icon: <I.Users />, permission: ['clientes_ver_proprios', 'clientes_ver_todos', 'clientes_criar', 'clientes_editar', 'clientes_excluir'] },
    { id: 'funil', label: 'Funil de vendas', icon: <I.Funnel />, badge: counts?.active, permission: 'funil_vendas' },
    { id: 'retornos', label: 'Retornos', icon: <I.Return />, badge: counts?.returns, permission: 'vendas' },
    { id: 'historico', label: 'Historico', icon: <I.History />, permission: 'historico_visualizar' },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const admin = [
    { id: 'usuarios', label: 'Usuarios', icon: <I.Users />, permission: ['crud_usuarios', 'usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'gerenciar_permissoes'] },
    { id: 'config', label: 'Configuracoes', icon: <I.Settings />, permission: ['crud_operadoras', 'crud_links', 'crud_tipos_venda', 'crud_servicos'] },
    { id: 'metas', label: 'Configurar Metas', icon: <I.Settings />, permission: ['gerenciar_metas'] },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getMetaKey = (meta) => (
    meta.tipo || `${meta.periodo || 'diaria'}_${meta.categoria || 'registro_cliente'}`
  );

  const giftMetas = metas.filter(m => m.is_gift);
  const resgatadas = new Set((progresso.resgatadas || []).map(Number));

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="sidebar-logo">
        <div className="logo-placeholder">POS VENDA</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Operacao</div>
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
            <div className="sidebar-section-title">Administracao</div>
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

      {giftMetas.length > 0 && (
        <div className="sidebar-goals">
          <div className="header-row">
            <span className="title">Metas</span>
            <span className="count">{giftMetas.filter(m => {
              return resgatadas.has(Number(m.id));
            }).length}/{giftMetas.length}</span>
          </div>
          {giftMetas.map(meta => {
            const current = progresso[getMetaKey(meta)] ?? 0;
            const target = Number(meta.target) || 0;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const achieved = pct >= 100;
            const claimed = resgatadas.has(Number(meta.id));
            return (
              <div key={meta.id} className={`sidebar-goal ${achieved ? 'achieved' : ''} ${claimed ? 'claimed' : ''}`} title={claimed ? 'Recompensa resgatada' : 'Recompensa ainda nao resgatada'}>
                <div className="top">
                  <span className="g-icon">{claimed ? '✅' : '🎁'}</span>
                  <span className="g-name">{meta.desc}</span>
                  <span className="g-pct">{pct}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: achieved ? 'var(--success)' : 'var(--text)' }}></div>
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
