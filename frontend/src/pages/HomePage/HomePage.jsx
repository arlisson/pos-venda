import React, { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { STAGES, DEFAULT_OPERATORS } from '../../config/constants';
import { listarOperadoras } from '../../services/config.service';

const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const formatDateTime = (d) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function timeAgo(d) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

const STAGE_LABELS = {
  aprovacao: 'Aprovação',
  ativacao: 'Ativação',
  envio: 'Envio / Logística',
  entrega: 'Entrega',
  confirmacao: 'Confirmação do cliente',
  concluido: 'Concluído',
  retorno: 'Retorno',
};

const INITIAL_SALES = [
  {
    id: 'VND-1001',
    client: 'Auto Peças Andrade',
    value: 150.00,
    operator: 'Vivo',
    plan: 'Controle 20GB',
    cpfCnpj: '12.345.678/0001-90',
    seller: { name: 'Camila Souza', initials: 'CS' },
    linha: '(11) 912345678',
    iccid: '89550102082068484460',
    endereco: 'Rua das Flores, 100 - São Paulo/SP',
    stage: 'aprovacao',
    lancadaEm: new Date('2026-04-10T09:00:00'),
    updated: new Date('2026-04-22T14:30:00'),
    historico: [
      { acao: 'Movido para Aprovação', autor: 'Camila Souza', data: new Date('2026-04-22T14:30:00'), tipo: 'move' },
      { acao: 'Venda lançada no sistema', autor: 'Camila Souza', data: new Date('2026-04-10T09:00:00'), tipo: 'create' },
    ],
  },
  {
    id: 'VND-1002',
    client: 'Maria Fernanda Costa',
    value: 311.86,
    operator: 'TIM',
    plan: 'Pós Empresarial 100GB',
    cpfCnpj: '128.554.881-22',
    seller: { name: 'Camila Souza', initials: 'CS' },
    linha: '(11) 983375752',
    iccid: '89550102082068484460',
    endereco: 'Av. Brasil, 4500 - Rio de Janeiro/RJ',
    stage: 'aprovacao',
    lancadaEm: new Date('2026-04-04T11:10:00'),
    updated: new Date('2026-04-05T11:10:00'),
    historico: [
      { acao: 'Movido para Aprovação', autor: 'Camila Souza', data: new Date('2026-04-05T11:10:00'), tipo: 'move' },
      { acao: 'Venda lançada no sistema', autor: 'Camila Souza', data: new Date('2026-04-04T11:10:00'), tipo: 'create' },
    ],
  },
  {
    id: 'VND-1003',
    client: 'Construtora Lince',
    value: 450.00,
    operator: 'Claro',
    plan: 'Empresarial 50GB',
    cpfCnpj: '98.765.432/0001-55',
    seller: { name: 'João Pedro', initials: 'JP' },
    linha: '(21) 998765432',
    iccid: '89550102082068484461',
    endereco: 'Av. Paulista, 1000 - São Paulo/SP',
    stage: 'envio',
    lancadaEm: new Date('2026-04-08T10:00:00'),
    updated: new Date('2026-04-20T16:00:00'),
    historico: [
      { acao: 'Movido para Envio / Logística', autor: 'João Pedro', data: new Date('2026-04-20T16:00:00'), tipo: 'move' },
      { acao: 'Movido para Ativação', autor: 'João Pedro', data: new Date('2026-04-15T10:00:00'), tipo: 'move' },
      { acao: 'Venda lançada no sistema', autor: 'João Pedro', data: new Date('2026-04-08T10:00:00'), tipo: 'create' },
    ],
  },
  {
    id: 'VND-1004',
    client: 'Mercado Boa Compra',
    value: 120.00,
    operator: 'Vivo',
    plan: 'Controle 20GB',
    cpfCnpj: '11.222.333/0001-44',
    seller: { name: 'Camila Souza', initials: 'CS' },
    linha: '(11) 912341234',
    iccid: '89550102082068484462',
    endereco: 'Rua do Comércio, 50 - Campinas/SP',
    stage: 'concluido',
    lancadaEm: new Date('2026-04-01T08:00:00'),
    updated: new Date('2026-04-15T12:00:00'),
    historico: [
      { acao: 'Venda concluída', autor: 'Camila Souza', data: new Date('2026-04-15T12:00:00'), tipo: 'create' },
      { acao: 'Venda lançada no sistema', autor: 'Camila Souza', data: new Date('2026-04-01T08:00:00'), tipo: 'create' },
    ],
  },
];

function SaleModal({ sale, onClose, onUpdateStage }) {
  const [tab, setTab] = useState('info');
  const [novaFase, setNovaFase] = useState(sale.stage);
  const [observacao, setObservacao] = useState('');

  const alterou = novaFase !== sale.stage || observacao.trim() !== '';

  function handleAtualizar() {
    onUpdateStage(sale.id, novaFase, observacao.trim());
    onClose();
  }

  function handleRetorno() {
    onUpdateStage(sale.id, 'retorno', observacao.trim() || 'Marcado como retorno.');
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-row">
            <div style={{ minWidth: 0 }}>
              <div className="modal-client">{sale.client}</div>
              <div className="modal-sub">{sale.id} · {sale.operator} · {sale.plan}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span className="pill">
                <span className="pill-dot"></span>
                {STAGE_LABELS[sale.stage]}
              </span>
              <button className="btn btn-icon btn-ghost" onClick={onClose}>
                <I.Close size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {[
            { id: 'info', label: 'Informações' },
            { id: 'historico', label: 'Histórico' },
            { id: 'status', label: 'Atualizar status' },
          ].map(t => (
            <button
              key={t.id}
              className={`modal-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Informações */}
          {tab === 'info' && (
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">VALOR</div>
                <div className="value big">{formatBRL(sale.value)}</div>
              </div>
              <div className="detail-item">
                <div className="label">VENDEDOR</div>
                <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-3)', fontSize: 9, fontWeight: 700, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {sale.seller.initials}
                  </span>
                  {sale.seller.name}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">CPF / CNPJ</div>
                <div className="value mono">{sale.cpfCnpj}</div>
              </div>
              <div className="detail-item">
                <div className="label">OPERADORA</div>
                <div className="value">{sale.operator}</div>
              </div>
              <div className="detail-item">
                <div className="label">PLANO</div>
                <div className="value">{sale.plan}</div>
              </div>
              <div className="detail-item">
                <div className="label">LINHA</div>
                <div className="value mono">{sale.linha}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="label">ICCID</div>
                <div className="value mono">{sale.iccid}</div>
              </div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="label">ENDEREÇO DE ENTREGA</div>
                <div className="value">{sale.endereco}</div>
              </div>
              <div className="detail-item">
                <div className="label">LANÇADA EM</div>
                <div className="value">{formatDate(sale.lancadaEm)}</div>
              </div>
              <div className="detail-item">
                <div className="label">ATUALIZADA</div>
                <div className="value">{timeAgo(sale.updated)}</div>
              </div>
            </div>
          )}

          {/* Histórico */}
          {tab === 'historico' && (
            <div className="sale-timeline">
              {sale.historico.map((item, i) => (
                <div key={i} className="sale-tl-item">
                  <div className={`sale-tl-dot ${item.tipo}`}>
                    {item.tipo === 'create' && (
                      <I.Check size={11} style={{ color: '#fff', strokeWidth: 2.5 }} />
                    )}
                  </div>
                  <div className="sale-tl-content">
                    <div className="sale-tl-title">{item.acao}</div>
                    <div className="sale-tl-meta">{item.autor} · {formatDateTime(item.data)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Atualizar status */}
          {tab === 'status' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                Mover esta venda para a fase
              </div>
              <div className="stage-selector">
                {STAGES.map(st => (
                  <button
                    key={st.id}
                    className={`stage-chip ${novaFase === st.id ? 'active' : ''}`}
                    onClick={() => setNovaFase(st.id)}
                  >
                    {st.name}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                  Observação (opcional)
                </div>
                <textarea
                  className="obs-textarea"
                  placeholder="Adicione um detalhe sobre essa atualização..."
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button
                  className="btn btn-sm"
                  style={{ color: 'var(--danger)', borderColor: '#fecaca' }}
                  onClick={handleRetorno}
                >
                  <I.AlertTriangle size={13} /> Marcar como retorno
                </button>
                {alterou && (
                  <button className="btn btn-primary btn-sm" onClick={handleAtualizar}>
                    Confirmar mudança
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>

      </div>
    </div>
  );
}

function SaleCard({ sale, onClick }) {
  return (
    <div className="sale-card" onClick={onClick}>
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
        <span style={{ fontSize: '10px' }}>{timeAgo(sale.updated)}</span>
      </div>
    </div>
  );
}

function HomePage() {
  const [sales, setSales] = useState(INITIAL_SALES);
  const [filter, setFilter] = useState('todas');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [operadoras, setOperadoras] = useState(DEFAULT_OPERATORS);

  useEffect(() => {
    async function carregarOperadoras() {
      try {
        const dados = await listarOperadoras();
        setOperadoras(dados.map(operadora => operadora.nome));
      } catch (error) {
        setOperadoras(DEFAULT_OPERATORS);
      }
    }

    carregarOperadoras();
  }, []);

  function handleUpdateStage(saleId, novaFase, observacao) {
    setSales(prev => prev.map(s => {
      if (s.id !== saleId) return s;

      const entries = [];
      if (novaFase !== s.stage) {
        entries.push({
          acao: `Movido para ${STAGE_LABELS[novaFase]}`,
          autor: 'Você',
          data: new Date(),
          tipo: 'move',
        });
      }
      if (observacao) {
        entries.push({ acao: observacao, autor: 'Você', data: new Date(), tipo: 'obs' });
      }

      return { ...s, stage: novaFase, updated: new Date(), historico: [...entries, ...s.historico] };
    }));
  }

  const filtradas = sales.filter(
    s => s.stage !== 'retorno' && (filter === 'todas' || s.operator === filter)
  );
  const total = filtradas.reduce((sum, s) => sum + s.value, 0);
  const selectedSale = selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null;

  return (
    <LayoutPrivado>
      {selectedSale && (
        <SaleModal
          sale={selectedSale}
          onClose={() => setSelectedSaleId(null)}
          onUpdateStage={handleUpdateStage}
        />
      )}

      <div className="page">
        <div className="filters">
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>Operadora:</span>
          {['todas', ...operadoras].map(op => (
            <button
              key={op}
              className={`filter-chip ${filter === op ? 'active' : ''}`}
              onClick={() => setFilter(op)}
            >
              {op === 'todas' ? 'Todas' : op}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
            <span className="muted">{filtradas.length} vendas</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>
              <span className="muted">Total: </span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBRL(total)}</strong>
            </span>
          </div>
        </div>

        <div className="kanban">
          {STAGES.map(st => {
            const items = filtradas.filter(s => s.stage === st.id);
            const colTotal = items.reduce((sum, s) => sum + s.value, 0);
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
                    <span className="value">{formatBRL(colTotal)}</span>
                  </div>
                </div>
                <div className="column-body">
                  {items.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                      Vazio
                    </div>
                  ) : (
                    items.map(s => (
                      <SaleCard key={s.id} sale={s} onClick={() => setSelectedSaleId(s.id)} />
                    ))
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
