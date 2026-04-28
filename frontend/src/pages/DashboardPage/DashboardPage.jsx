import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getMetas } from '../../services/meta.service';
import { getUsuarioLocal } from '../../services/auth.service';
import * as I from '../../components/Icons';
import './DashboardPage.css';

const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Mock de progresso do usuário por tipo de meta
const USER_PROGRESS = {
  clientes: 0,
  chips: 4,
  port_vivo: 0,
  port_claro: 2,
  negociacoes: 5,
  diaria: 8,
};

const STATS = {
  vendasMes: 34,
  pipeline: 5429.01,
  pipelineCount: 23,
  concluidas: 7,
  retornos: 4,
  perda: 1008.74,
};

const RETORNOS_PENDING = 4;

function medal(pct) {
  if (pct >= 100) return '🥇';
  if (pct >= 50)  return '🥈';
  if (pct >= 10)  return '🥉';
  return '⭐';
}

function RewardModal({ gift, onClose }) {
  if (!gift) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
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

function MetaCard({ meta, index, total, current, isOpened, onOpen }) {
  const pct = Math.min(100, Math.round((current / meta.target) * 100));
  const isDone = pct >= 100;
  const canClaim = isDone && !isOpened;

  return (
    <div className={`meta-card ${isDone ? 'done' : ''}`}>
      <div className="meta-card-top">
        <div className="meta-card-meta-label">
          <span className="meta-card-medal">{medal(pct)}</span>
          META {index + 1} DE {total}
        </div>
        {canClaim && (
          <div className="meta-card-badge">
            <span className="meta-card-badge-dot" />
            Disponível
          </div>
        )}
        {isOpened && (
          <div className="meta-card-badge">
            <span className="meta-card-badge-dot" />
            Resgatado
          </div>
        )}
      </div>

      <div className="meta-card-title">{meta.desc}</div>

      <div className="meta-card-bar-bg">
        <div className="meta-card-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="meta-card-progress-row">
        <span className="meta-card-progress-nums">
          {current} / {meta.target}
        </span>
        <span className="meta-card-progress-pct">{pct}%</span>
      </div>

      <hr className="meta-card-divider" />
      <div className="meta-card-reward-label">Recompensa</div>
      <div className="meta-card-reward-text">{meta.reward}</div>

      {canClaim && (
        <button className="meta-card-cta" onClick={() => onOpen(meta)}>
          Resgatar recompensa
        </button>
      )}
      {isOpened && (
        <button className="meta-card-cta" style={{ opacity: 0.5, cursor: 'default' }} disabled>
          Recompensa resgatada ✓
        </button>
      )}
      {!isDone && (
        <div className="meta-card-faltam">
          Faltam {meta.target - current}
        </div>
      )}
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();
  const [metas, setMetas] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);
  const [openedGifts, setOpenedGifts] = useState(new Set());

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);
  }, []);

  const giftMetas = metas.filter(m => m.is_gift);
  const done = giftMetas.filter(m => (USER_PROGRESS[m.tipo] || 0) >= m.target).length;
  const overallPct = giftMetas.length
    ? Math.round((done / giftMetas.length) * 100)
    : 0;

  const firstName = usuario?.nome?.split(' ')[0] || 'você';

  const handleOpenGift = (gift) => {
    setSelectedReward(gift);
    setOpenedGifts(prev => new Set([...prev, gift.id]));
  };

  return (
    <LayoutPrivado>
      <div className="dashboard-container">
        <RewardModal gift={selectedReward} onClose={() => setSelectedReward(null)} />

        {/* Greeting */}
        <div className="dash-greeting">
          <div className="dash-greeting-text">
            <h1>Bem-vindo, {firstName} 👋</h1>
            <div className="dash-greeting-sub">Aqui está um resumo rápido do seu dia.</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/funil')}>
            + Lançar nova venda
          </button>
        </div>

        {/* Alert retornos */}
        {RETORNOS_PENDING > 0 && (
          <div className="dash-alert">
            <div className="dash-alert-body">
              <span className="dash-alert-icon"><I.AlertTriangle size={20} /></span>
              <div>
                <div className="dash-alert-title">
                  {RETORNOS_PENDING} chips retornaram e precisam da sua atenção
                </div>
                <div className="dash-alert-desc">
                  Total de <strong>{formatBRL(STATS.perda)}</strong> em perda registrada. Verifique os motivos e tome a ação necessária.
                </div>
              </div>
            </div>
            <button
              className="btn"
              style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)', flexShrink: 0, gap: 6 }}
              onClick={() => navigate('/retornos')}
            >
              Ver retornos →
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Vendas no mês</div>
            <div className="stat-value">{STATS.vendasMes}</div>
            <div className="stat-sub up">↑ 8% vs. mês anterior</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Em pipeline</div>
            <div className="stat-value">{formatBRL(STATS.pipeline)}</div>
            <div className="stat-sub">{STATS.pipelineCount} vendas em andamento</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Concluídas</div>
            <div className="stat-value">{STATS.concluidas}</div>
            <div className="stat-sub ok">Meta de fechamento em dia</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Retornos</div>
            <div className="stat-value danger">{STATS.retornos}</div>
            <div className="stat-sub bad">{formatBRL(STATS.perda)} em perda</div>
          </div>
        </div>

        {/* Metas e Recompensas */}
        {giftMetas.length > 0 && (
          <div className="metas-section">
            <div className="metas-section-header">
              <div>
                <div className="metas-section-title">Suas metas e recompensas</div>
                <div className="metas-section-sub">
                  {done} de {giftMetas.length} metas batidas neste mês
                </div>
              </div>
              <div className="metas-overall">
                <span className="metas-overall-label">Progresso geral</span>
                <div className="metas-overall-bar-bg">
                  <div className="metas-overall-bar-fill" style={{ width: `${overallPct}%` }} />
                </div>
                <span className="metas-overall-pct">{overallPct}%</span>
              </div>
            </div>

            <div className="metas-grid">
              {giftMetas.map((meta, idx) => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  index={idx}
                  total={giftMetas.length}
                  current={USER_PROGRESS[meta.tipo] || 0}
                  isOpened={openedGifts.has(meta.id)}
                  onOpen={handleOpenGift}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default DashboardPage;
