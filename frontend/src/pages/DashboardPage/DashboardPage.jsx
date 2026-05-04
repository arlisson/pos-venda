import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getMetas, getProgresso, getProgressoUsuarios, resgatarMeta } from '../../services/meta.service';
import { obterResumoVendas } from '../../services/venda.service';
import { listarNotificacoes, marcarNotificacaoLida } from '../../services/notificacao.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import * as I from '../../components/Icons';
import './DashboardPage.css';

const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isMoneyGoal = (meta) => (
  /R\$/i.test(meta.desc || '') ||
  ['valor', 'receita', 'faturamento'].some(key => String(meta.tipo || '').toLowerCase().includes(key))
);

const formatGoalValue = (meta, value) => (
  isMoneyGoal(meta) ? formatBRL(value) : value
);

const PERIOD_LABELS = {
  diaria: 'Diaria',
  semanal: 'Semanal',
};

const CATEGORY_LABELS = {
  registro_cliente: 'Registro de cliente',
  chip_novo: 'Chip novo',
  portabilidade: 'Portabilidade',
  internet: 'Internet',
};

function getMetaKey(meta) {
  return meta.tipo || `${meta.periodo || 'diaria'}_${meta.categoria || 'registro_cliente'}`;
}

function getMetaScope(meta) {
  const periodo = PERIOD_LABELS[meta.periodo] || 'Diaria';
  const categoria = CATEGORY_LABELS[meta.categoria] || meta.categoria || 'Meta';
  const operadora = meta.operadora_nome ? ` - ${meta.operadora_nome}` : '';
  return `${periodo} - ${categoria}${operadora}`;
}

const EMPTY_STATS = {
  vendasDia: 0,
  valorDia: 0,
  concluidasDia: 0,
  pipeline: 0,
  pipelineCount: 0,
  retornos: 0,
  perda: 0
};

function RewardModal({ gift, onClose }) {
  if (!gift) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div className="modal" style={{ width: 380, padding: '32px 28px' }} onClick={e => e.stopPropagation()}>
        <div className="reward-modal-content">
          <span className="reward-emoji">🎉</span>
          <div className="reward-title">Parabéns!</div>
          <div className="reward-subtitle">
            Você completou: <strong>{gift.desc}</strong>
          </div>
          <div className="reward-pill">{gift.reward}</div>
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={onClose}>Incrível!</button>
        </div>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function getNotificationTarget(notificacao) {
  if (notificacao.tipo === 'cliente_fidelidade') {
    return '/clientes?fidelidade=alerta';
  }

  if (notificacao.entidade === 'clientes') {
    const clienteId = notificacao.entidade_id || notificacao.dados?.entidade_id;
    return clienteId ? `/clientes?cliente_id=${clienteId}&highlight=${clienteId}` : '/clientes';
  }

  if (notificacao.entidade === 'vendas') {
    return '/vendas';
  }

  return null;
}

function DashboardPage() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();
  const [metas, setMetas] = useState([]);
  const [progresso, setProgresso] = useState({});
  const [stats, setStats] = useState(EMPTY_STATS);
  const [openedGifts, setOpenedGifts] = useState(new Set());
  const [claimingId, setClaimingId] = useState(null);
  const [selectedReward, setSelectedReward] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [progressoUsuarios, setProgressoUsuarios] = useState([]);
  const [usuarioMetaFiltro, setUsuarioMetaFiltro] = useState('');
  const [usuarioMetaBusca, setUsuarioMetaBusca] = useState('');
  const [notificacoes, setNotificacoes] = useState([]);
  const podeVerResumoVendas = temPermissao(usuario, 'dashboard_resumo_vendas');
  const podeVerRetornos = temPermissao(usuario, ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas']);
  const podeVerMetasUsuarios = temPermissao(usuario, 'metas_ver_usuarios');
  const podeVerNotificacoes = temPermissao(usuario, 'notificacoes_visualizar');

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), feedback.type === 'success' ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);

    if (podeVerResumoVendas || podeVerRetornos) {
      obterResumoVendas().then(setStats).catch(console.error);
    }

    getProgresso()
      .then(data => {
        setProgresso(data);
        setOpenedGifts(new Set((data.resgatadas || []).map(Number)));
      })
      .catch(console.error);
  }, [podeVerResumoVendas, podeVerRetornos]);

  useEffect(() => {
    if (!podeVerMetasUsuarios) return undefined;

    getProgressoUsuarios()
      .then(data => setProgressoUsuarios(data.usuarios || []))
      .catch(console.error);
  }, [podeVerMetasUsuarios]);

  useEffect(() => {
    if (!podeVerNotificacoes) {
      return undefined;
    }

    listarNotificacoes({ limit: 5 })
      .then(data => setNotificacoes(data.notificacoes || []))
      .catch(console.error);
  }, [podeVerNotificacoes]);

  async function handleReadNotification(notificacao) {
    if (!notificacao.lida) {
      await marcarNotificacaoLida(notificacao.id);
      setNotificacoes(prev => prev.map(item => (
        item.id === notificacao.id ? { ...item, lida: true } : item
      )));
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    }

    const target = getNotificationTarget(notificacao);

    if (target) {
      navigate(target);
    }
  }

  const buscaUsuarioMetaNormalizada = usuarioMetaBusca.trim().toLowerCase();
  const progressoUsuariosFiltrados = progressoUsuarios.filter(item => {
    if (usuarioMetaFiltro && String(item.id) !== String(usuarioMetaFiltro)) {
      return false;
    }

    if (!buscaUsuarioMetaNormalizada) {
      return true;
    }

    return [item.nome, item.email]
      .filter(Boolean)
      .some(valor => String(valor).toLowerCase().includes(buscaUsuarioMetaNormalizada));
  });

  const giftMetas = metas.filter(m => m.is_gift);
  
  // Calcular metas atingidas
  const metasComProgresso = giftMetas.map(meta => {
    const current = progresso.metas?.[meta.id] ?? progresso[getMetaKey(meta)] ?? 0;
    const target = Number(meta.target) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { ...meta, current, pct, achieved: pct >= 100 };
  });

  const doneCount = metasComProgresso.filter(m => m.achieved).length;
  const totalCount = metasComProgresso.length;
  const overallPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const firstName = usuario?.nome?.split(' ')[0] || 'você';
  const notificacoesFidelidade = notificacoes
    .filter(notificacao => notificacao.tipo === 'cliente_fidelidade')
    .sort((a, b) => Number(a.dados?.dias_restantes ?? 999) - Number(b.dados?.dias_restantes ?? 999));
  const outrasNotificacoes = notificacoes.filter(notificacao => notificacao.tipo !== 'cliente_fidelidade');
  const proximaFidelidade = notificacoesFidelidade[0];
  const fidelidadeTextoPrazo = proximaFidelidade?.dados?.dias_restantes < 0
    ? `vencida ha ${Math.abs(proximaFidelidade.dados.dias_restantes)} dia${Math.abs(proximaFidelidade.dados.dias_restantes) === 1 ? '' : 's'}`
    : proximaFidelidade?.dados?.dias_restantes === 0
      ? 'vence hoje'
      : `vence em ${proximaFidelidade?.dados?.dias_restantes} dias`;

  const handleOpenGift = async (meta) => {
    setClaimingId(meta.id);
    setFeedback(null);

    try {
      const result = await resgatarMeta(meta.id);
      setOpenedGifts(prev => new Set([...prev, Number(meta.id)]));
      setSelectedReward({
        ...meta,
        reward: result.reward || meta.reward
      });
      setFeedback({ type: 'success', text: 'Meta resgatada com sucesso.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', text: error.message || 'Erro ao resgatar meta.' });
    } finally {
      setClaimingId(null);
    }
  };

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <LayoutPrivado>
      <div className="dashboard-container">
        <RewardModal gift={selectedReward} onClose={() => setSelectedReward(null)} />
        {feedback && (
          <div className={`alert-${feedback.type === 'success' ? 'success' : 'error'} alert-timed alert-timed--${feedback.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>
            {feedback.text}
          </div>
        )}

        {/* Saudação */}
        <div className="home-greeting">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Bem-vindo(a), {firstName} 👋</h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '4px 0 0' }}>
              Hoje é {hoje}.
            </p>
          </div>
        </div>

        {/* Alerta de Retornos */}
        {stats.retornos > 0 && (
          <div className="alert-banner">
            <div className="alert-icon">
              <I.AlertTriangle size={22} />
            </div>
            <div className="alert-body">
              <div className="alert-title">
                {stats.retornos} {stats.retornos === 1 ? 'chip retornou' : 'chips retornaram'} e precisa{stats.retornos === 1 ? '' : 'm'} da sua atenção
              </div>
              <div className="alert-sub">
                Total de <strong>{formatBRL(stats.perda)}</strong> em perda registrada. Verifique os motivos e tome a ação necessária.
              </div>
            </div>
            <button className="btn btn-danger" onClick={() => navigate('/retornos')}>
              Ver retornos <I.ArrowRight size={14} />
            </button>
          </div>
        )}

        {(notificacoesFidelidade.length > 0 || outrasNotificacoes.length > 0) && (
          <section className="home-notifications">
            <div className="home-notifications__header">
              <div>
                <h2>Notificacoes</h2>
                <p>Avisos importantes para acompanhar hoje.</p>
              </div>
            </div>

            <div className="home-notifications__list">
              {notificacoesFidelidade.length > 0 && (
                <button
                  type="button"
                  className={`home-notification home-notification--summary ${proximaFidelidade?.lida ? '' : 'is-unread'} ${proximaFidelidade?.nivel || 'info'}`}
                  onClick={() => handleReadNotification(proximaFidelidade)}
                >
                  <span className="home-notification__icon">
                    <I.Bell size={16} />
                  </span>
                  <span className="home-notification__content">
                    <strong>
                      {notificacoesFidelidade.length} cliente{notificacoesFidelidade.length === 1 ? '' : 's'} com fidelidade perto do fim
                    </strong>
                    <span>
                      Maior urgencia: {proximaFidelidade?.dados?.cliente_nome || 'cliente'} - {fidelidadeTextoPrazo}.
                    </span>
                  </span>
                  {proximaFidelidade?.dados?.dias_restantes !== undefined && (
                    <span className="home-notification__days">
                      {proximaFidelidade.dados.dias_restantes === 0
                        ? 'Hoje'
                        : proximaFidelidade.dados.dias_restantes < 0
                          ? 'Vencida'
                        : `${proximaFidelidade.dados.dias_restantes} dias`}
                    </span>
                  )}
                </button>
              )}

              {outrasNotificacoes.map(notificacao => (
                <button
                  key={notificacao.destinatario_id || notificacao.id}
                  type="button"
                  className={`home-notification ${notificacao.lida ? '' : 'is-unread'} ${notificacao.nivel || 'info'}`}
                  onClick={() => handleReadNotification(notificacao)}
                >
                  <span className="home-notification__icon">
                    <I.Bell size={16} />
                  </span>
                  <span className="home-notification__content">
                    <strong>{notificacao.titulo}</strong>
                    <span>{notificacao.mensagem}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* KPIs do DIA */}
        {podeVerResumoVendas && (
          <>
        <h2 className="home-section-title">Hoje</h2>
        <div className="stats-row">
          <div className="stat-card">
            <div className="label">Vendas no dia</div>
            <div className="value">{stats.vendasDia}</div>
            <div className="delta">Lançadas hoje</div>
          </div>
          <div className="stat-card">
            <div className="label">Valor vendido hoje</div>
            <div className="value">{formatBRL(stats.valorDia)}</div>
            <div className="delta">Soma das vendas do dia</div>
          </div>
          <div className="stat-card">
            <div className="label">Concluídas hoje</div>
            <div className="value">{stats.concluidasDia}</div>
            <div className="delta">Fechadas no dia</div>
          </div>
          <div className="stat-card">
            <div className="label">Em pipeline</div>
            <div className="value">{formatBRL(stats.pipeline)}</div>
            <div className="delta">{stats.pipelineCount} em andamento</div>
          </div>
        </div>
          </>
        )}

        {/* Sistema de recompensas DIÁRIAS */}
        {metasComProgresso.length > 0 && (
          <>
            <div className="rewards-header">
              <div>
                <h2>Metas</h2>
                <p>
                  Bata cada meta para liberar uma recompensa surpresa.
                </p>
              </div>

              <div className="rewards-progress-summary">
                <span>Progresso de metas</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${overallPct}%` }} />
                </div>
                <strong>{doneCount}/{totalCount}</strong>
              </div>
            </div>

            <div className="rewards-grid">
              {metasComProgresso.map((meta, i) => {
                const isClaimed = openedGifts.has(meta.id);
                const isClaiming = claimingId === meta.id;
                const remaining = Math.max(0, meta.target - meta.current);
                return (
                  <div key={meta.id} className={`reward-card ${meta.achieved ? 'achieved' : ''} ${isClaimed ? 'claimed' : ''}`}>
                    <div className="reward-top">
                      <div className="reward-icon">{isClaimed ? '✅' : meta.achieved ? '🎉' : '🎁'}</div>
                      <div className="reward-step">Meta {i + 1}</div>
                      <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}>
                        {getMetaScope(meta)}
                      </span>
                      {meta.achieved && !isClaimed && (
                        <span style={{ 
                          marginLeft: 'auto', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 5, 
                          padding: '2px 8px', 
                          borderRadius: 12, 
                          fontSize: 11, 
                          fontWeight: 500, 
                          background: 'var(--success-bg)', 
                          color: 'var(--success)', 
                          border: '1px solid #bbf7d0' 
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}></span>
                          Disponível
                        </span>
                      )}
                      {isClaimed && (
                        <span style={{ 
                          marginLeft: 'auto', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 5, 
                          padding: '2px 8px', 
                          borderRadius: 12, 
                          fontSize: 11, 
                          fontWeight: 500, 
                          background: 'var(--surface-2)', 
                          color: 'var(--text-2)', 
                          border: '1px solid var(--border)' 
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)' }}></span>
                          Resgatada
                        </span>
                      )}
                    </div>
                    
                    <div className="reward-name">{meta.desc}</div>
                    {isClaimed && meta.reward && (
                      <div className="reward-claimed-prize">
                        Prêmio ganho: {meta.reward}
                      </div>
                    )}
                    
                    <div className="reward-progress">
                      <div className="progress-track" style={{ height: 8 }}>
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${meta.pct}%`, 
                            background: meta.achieved ? 'var(--success)' : 'var(--text)' 
                          }} 
                        />
                      </div>
                      <div className="reward-numbers">
                        <span>
                          {formatGoalValue(meta, meta.current)}
                          <span> / {formatGoalValue(meta, meta.target)}</span>
                        </span>
                        <span>{meta.pct}%</span>
                      </div>
                    </div>

                    <button
                      className={`btn ${meta.achieved && !isClaimed ? 'btn-primary' : ''}`}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      disabled={!meta.achieved || isClaimed || isClaiming}
                      onClick={() => handleOpenGift(meta)}
                    >
                      {isClaiming
                        ? 'Resgatando...'
                        : isClaimed 
                        ? <><I.Check size={13} /> Resgatada</> 
                        : meta.achieved 
                          ? 'Resgatar surpresa 🎁' 
                          : `Faltam ${formatGoalValue(meta, remaining)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {podeVerMetasUsuarios && progressoUsuarios.length > 0 && (
          <section className="team-goals">
            <div className="team-goals__header">
              <div>
                <h2>Metas por usuário</h2>
                <p>Acompanhe quem ja bateu as metas e quem ainda esta pendente.</p>
              </div>

              <div className="team-goals__filters">
                <label className="team-goals__filter">
                  <span>Buscar</span>
                  <input
                    value={usuarioMetaBusca}
                    onChange={event => setUsuarioMetaBusca(event.target.value)}
                    placeholder="Nome ou e-mail"
                  />
                </label>

                <label className="team-goals__filter">
                  <span>Usuário</span>
                  <select value={usuarioMetaFiltro} onChange={event => setUsuarioMetaFiltro(event.target.value)}>
                    <option value="">Todos os usuários</option>
                    {progressoUsuarios.map(item => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="team-goals__grid">
              {progressoUsuariosFiltrados.map(item => {
                const total = item.resumo?.total || 0;
                const atingidas = item.resumo?.atingidas || 0;
                const pct = total > 0 ? Math.round((atingidas / total) * 100) : 0;

                return (
                  <article key={item.id} className="team-goal-card">
                    <div className="team-goal-card__top">
                      <div className="mini-avatar">
                        {item.foto_perfil ? (
                          <img src={item.foto_perfil} alt={item.nome || 'Usuário'} />
                        ) : (
                          getInitials(item.nome)
                        )}
                      </div>
                      <div>
                        <strong>{item.nome}</strong>
                        <span>{atingidas}/{total} metas atingidas · {item.resumo?.resgatadas || 0} resgatadas</span>
                      </div>
                      <b>{pct}%</b>
                    </div>

                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="team-goal-list">
                      {(item.metas || []).map(meta => (
                        <div key={meta.id} className={`team-goal-item ${meta.achieved ? 'is-achieved' : ''}`}>
                          <span className="team-goal-item__status">
                            {meta.claimed ? <I.Check size={12} /> : meta.achieved ? <I.Check size={12} /> : `${meta.pct}%`}
                          </span>
                          <div>
                            <strong>{meta.desc}</strong>
                            <span>
                              {formatGoalValue(meta, meta.current)} / {formatGoalValue(meta, meta.target)}
                              {meta.operadora_nome ? ` · ${meta.operadora_nome}` : ''}
                            </span>
                            {meta.claimed && meta.reward && (
                              <em>Premio ganho: {meta.reward}</em>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default DashboardPage;
