import React, { useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { STAGES, OPERATORS } from '../../config/constants';

// Helper para formatar moeda
const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Dados Mockados para o visual funcionar agora
const MOCK_SALES = [
  { id: 'VND-1001', client: 'Auto Peças Andrade', value: 150.00, operator: 'Vivo', plan: 'Controle 20GB', seller: { name: 'Camila', initials: 'CS' }, stage: 'aprovacao', updated: new Date() },
  { id: 'VND-1002', client: 'Maria Fernanda', value: 89.90, operator: 'TIM', plan: 'Pós 40GB', seller: { name: 'Rafael', initials: 'RL' }, stage: 'ativacao', updated: new Date() },
  { id: 'VND-1003', client: 'Construtora Lince', value: 450.00, operator: 'Claro', plan: 'Empresarial', seller: { name: 'João', initials: 'JP' }, stage: 'envio', updated: new Date() },
  { id: 'VND-1004', client: 'Mercado Boa Compra', value: 120.00, operator: 'Vivo', plan: 'Controle 20GB', seller: { name: 'Camila', initials: 'CS' }, stage: 'concluido', updated: new Date() },
];

function SaleCard({ sale }) {
  return (
    <div className="sale-card">
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
        <span style={{ fontSize: '10px' }}>Agora</span>
      </div>
    </div>
  );
}

function HomePage() {
  const [filter, setFilter] = useState('todas');

  return (
    <LayoutPrivado>
      <div className="page">
        <div className="filters">
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>Operadora:</span>
          {['todas', ...OPERATORS].map(op => (
            <button 
              key={op} 
              className={`filter-chip ${filter === op ? 'active' : ''}`} 
              onClick={() => setFilter(op)}
            >
              {op === 'todas' ? 'Todas' : op}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
            <span className="muted">{MOCK_SALES.length} vendas</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span><span className="muted">Total: </span><strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBRL(809.90)}</strong></span>
          </div>
        </div>

        <div className="kanban">
          {STAGES.map(st => {
            const items = MOCK_SALES.filter(s => s.stage === st.id && (filter === 'todas' || s.operator === filter));
            const total = items.reduce((sum, s) => sum + s.value, 0);
            return (
              <div key={st.id} className="kanban-column">
                <div className="column-header">
                  <div className="column-title-row">
                    <span className={`column-dot ${st.dot}`}></span>
                    <span className="column-name">{st.name}</span>
                    <span className="column-count">{items.length}</span>
                  </div>
                  <div className="column-total">
                    <span className="label">Total</span>
                    <span className="value">{formatBRL(total)}</span>
                  </div>
                </div>
                <div className="column-body">
                  {items.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Vazio</div>
                  ) : (
                    items.map(s => <SaleCard key={s.id} sale={s} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default HomePage;
