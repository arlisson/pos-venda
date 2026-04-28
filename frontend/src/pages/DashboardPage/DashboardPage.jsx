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
  vendasDia: 3,
  valorDia: 1250.00,
  concluidasDia: 1,
  pipeline: 5429.01,
  pipelineCount: 23,
  retornos: 4,
  perda: 1008.74,
};

const RETORNOS_PENDING = 4;

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
  const [openedGifts, setOpenedGifts] = useState(new Set());
  const [selectedReward, setSelectedReward] = useState(null);

  useEffect(() => {
    getMetas().then(setMetas).catch(console.error);
  }, []);

  const giftMetas = metas.filter(m => m.is_gift);
  
  // Calcular metas atingidas
  const metasComProgresso = giftMetas.map(meta => {
    const current = USER_PROGRESS[meta.tipo] || 0;
    const pct = Math.min(100, Math.round((current / meta.target) * 100));
    return { ...meta, current, pct, achieved: pct >= 100 };
  });

  const doneCount = metasComProgresso.filter(m => m.achieved).length;
  const totalCount = metasComProgresso.length;
  const overallPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const firstName = usuario?.nome?.split(' ')[0] || 'você';

  const handleOpenGift = (meta) => {
    setSelectedReward(meta);
    setOpenedGifts(prev => new Set([...prev, meta.id]));
  };

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <LayoutPrivado>
      <div className="dashboard-container">
        <RewardModal gift={selectedReward} onClose={() => setSelectedReward(null)} />

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
        {RETORNOS_PENDING > 0 && (
          <div className="alert-banner">
            <div className="alert-icon">
              <I.AlertTriangle size={22} />
            </div>
            <div className="alert-body">
              <div className="alert-title">
                {RETORNOS_PENDING} {RETORNOS_PENDING === 1 ? 'chip retornou' : 'chips retornaram'} e precisa{RETORNOS_PENDING === 1 ? '' : 'm'} da sua atenção
              </div>
              <div className="alert-sub">
                Total de <strong>{formatBRL(STATS.perda)}</strong> em perda registrada. Verifique os motivos e tome a ação necessária.
              </div>
            </div>
            <button className="btn btn-danger" onClick={() => navigate('/retornos')}>
              Ver retornos <I.ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* KPIs do DIA */}
        <h2 className="home-section-title">Hoje</h2>
        <div className="stats-row">
          <div className="stat-card">
            <div className="label">Vendas no dia</div>
            <div className="value">{STATS.vendasDia}</div>
            <div className="delta">Lançadas hoje</div>
          </div>
          <div className="stat-card">
            <div className="label">Valor vendido hoje</div>
            <div className="value">{formatBRL(STATS.valorDia)}</div>
            <div className="delta">Soma das vendas do dia</div>
          </div>
          <div className="stat-card">
            <div className="label">Concluídas hoje</div>
            <div className="value">{STATS.concluidasDia}</div>
            <div className="delta">Fechadas no dia</div>
          </div>
          <div className="stat-card">
            <div className="label">Em pipeline</div>
            <div className="value">{formatBRL(STATS.pipeline)}</div>
            <div className="delta">Em andamento</div>
          </div>
        </div>

        {/* Sistema de recompensas DIÁRIAS */}
        {metasComProgresso.length > 0 && (
          <>
            <div className="rewards-header">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Metas de hoje</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '2px 0 0' }}>
                  Bata cada meta para liberar uma recompensa surpresa. As metas reiniciam todo dia.
                </p>
              </div>

            </div>

            <div className="rewards-grid">
              {metasComProgresso.map((meta, i) => {
                const isClaimed = openedGifts.has(meta.id);
                return (
                  <div key={meta.id} className={`reward-card ${meta.achieved ? 'achieved' : ''} ${isClaimed ? 'claimed' : ''}`}>
                    <div className="reward-top">
                      <div className="reward-icon">{isClaimed ? '✅' : meta.achieved ? '🎉' : '🎁'}</div>
                      <div className="reward-step">Meta {i + 1}</div>
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
                          {meta.current}
                          <span style={{ color: 'var(--text-3)' }}> / {meta.target}</span>
                        </span>
                        <span>{meta.pct}%</span>
                      </div>
                    </div>

                    <button
                      className={`btn ${meta.achieved && !isClaimed ? 'btn-primary' : ''}`}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      disabled={!meta.achieved || isClaimed}
                      onClick={() => handleOpenGift(meta)}
                    >
                      {isClaimed 
                        ? <><I.Check size={13} /> Resgatada</> 
                        : meta.achieved 
                          ? 'Resgatar surpresa 🎁' 
                          : `Faltam ${Math.max(0, meta.target - meta.current)}`}
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
