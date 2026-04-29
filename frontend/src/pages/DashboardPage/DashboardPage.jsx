import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getMetas, getProgresso, resgatarMeta } from '../../services/meta.service';
import { obterResumoVendas } from '../../services/venda.service';
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
  return `${periodo} - ${categoria}`;
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
  const podeVerResumoVendas = temPermissao(usuario, 'dashboard_resumo_vendas');

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);

    if (podeVerResumoVendas) {
      obterResumoVendas().then(setStats).catch(console.error);
    }

    getProgresso()
      .then(data => {
        setProgresso(data);
        setOpenedGifts(new Set((data.resgatadas || []).map(Number)));
      })
      .catch(console.error);
  }, [podeVerResumoVendas]);

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
          <div className={`alert-${feedback.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 16 }}>
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
      </div>
    </LayoutPrivado>
  );
}

export default DashboardPage;
