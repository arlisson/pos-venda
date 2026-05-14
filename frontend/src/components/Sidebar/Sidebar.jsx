import { useEffect, useState } from 'react';
import * as I from '../Icons';
import logo from '../../assets/LogoClaraSemFundo.png';
import { temPermissao } from '../../services/auth.service';
import { getCampanhas, getProgresso } from '../../services/campanha.service';

function Sidebar({ page, setPage, counts, usuario, onLogout, onPerfilClick }) {
  const [campanhas, setCampanhas] = useState([]);
  const [progresso, setProgresso] = useState({});

  useEffect(() => {
    getCampanhas().then(setCampanhas).catch(console.error);
    getProgresso().then(setProgresso).catch(console.error);
  }, []);

  const items = [
    { id: 'dashboard', label: 'Inicio', icon: <I.Home /> },
    { id: 'vendas', label: 'Vendas', icon: <I.Chart />, permission: ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir'] },
    { id: 'clientes', label: 'Clientes', icon: <I.Users />, permission: ['clientes_ver_proprios', 'clientes_ver_todos', 'clientes_criar', 'clientes_editar', 'clientes_excluir'] },
    { id: 'futuros-clientes', label: 'Futuros Clientes', icon: <I.Calendar />, permission: ['futuros_clientes_ver'] },
    { id: 'funil', label: 'Funil de vendas', icon: <I.Funnel />, badge: counts?.active, permission: 'funil_vendas' },
    { id: 'aprovacoes', label: 'Aprovações', icon: <I.Shield />, badge: counts?.aprovacoes, alert: counts?.aprovacoes > 0, permission: 'vendas_aprovacoes_visualizar' },
    { id: 'retornos', label: 'Retornos', icon: <I.Return />, badge: counts?.returns, permission: 'vendas' },
    { id: 'relatorios', label: 'Relatórios', icon: <I.Chart />, permission: 'relatorios_visualizar' },
    { id: 'historico', label: 'Histórico', icon: <I.History />, permission: 'historico_visualizar' },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const admin = [
    { id: 'usuarios', label: 'Usuários', icon: <I.Users />, permission: ['crud_usuarios', 'usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'gerenciar_permissoes'] },
    { id: 'config', label: 'Configurações', icon: <I.Settings />, permission: ['crud_operadoras', 'crud_links', 'crud_tipos_venda', 'crud_servicos'] },
    { id: 'campanhas', label: 'Configurar Campanhas', icon: <I.Settings />, permission: ['gerenciar_campanhas'] },
    { id: 'fechamento-mensal', label: 'Fechamento Mensal', icon: <I.Chart />, permission: 'vendas_fechamento_mensal' },
    { id: 'leads', label: 'Planilhas de leads', icon: <I.LayoutList />, permission: 'gerenciar_leads' },
  ].filter(it => !it.permission || temPermissao(usuario, it.permission));

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getCampanhaKey = (campanha) => (
    campanha.tipo || `${campanha.periodo || 'diaria'}_${campanha.categoria || 'registro_cliente'}`
  );

  const giftCampanhas = campanhas.filter(m => m.is_gift);
  const resgatadas = new Set((progresso.resgatadas || []).map(Number));

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="sidebar-logo">
        <img src={logo} alt="Logo" className="sidebar-logo-img" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Operação</div>
            {items.map(it => (
              <button
                key={it.id}
                className={`nav-item ${page === it.id ? 'active' : ''} ${it.alert ? 'nav-item--alert' : ''}`}
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

      {giftCampanhas.length > 0 && (
        <div className="sidebar-goals">
          <div className="header-row">
            <span className="title">Campanhas</span>
            <span className="count">{giftCampanhas.filter(m => {
              return resgatadas.has(Number(m.id));
            }).length}/{giftCampanhas.length}</span>
          </div>
          {giftCampanhas.map(campanha => {
            const current = progresso.campanhas?.[campanha.id] ?? progresso[getCampanhaKey(campanha)] ?? 0;
            const target = Number(campanha.target) || 0;
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const achieved = pct >= 100;
            const claimed = resgatadas.has(Number(campanha.id));
            return (
              <div
                key={campanha.id}
                className={`sidebar-goal ${achieved ? 'achieved' : ''} ${claimed ? 'claimed' : ''}`}
                title={`${claimed ? 'Recompensa resgatada' : 'Recompensa ainda não resgatada'}${campanha.operadora_nome ? ` - ${campanha.operadora_nome}` : ''}`}
              >
                <div className="top">
                  <span className="g-icon">{claimed ? '✅' : '🎁'}</span>
                  <span className="g-name">{campanha.desc}</span>
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
