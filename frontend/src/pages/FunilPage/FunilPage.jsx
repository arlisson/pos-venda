import React, { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { STAGES, DEFAULT_OPERATORS as OPERATORS } from '../../config/constants';
import { atualizarStatusVenda, listarVendas } from '../../services/venda.service';

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STAGE_LABELS = {
  ...Object.fromEntries(STAGES.map(stage => [stage.id, stage.name])),
  retorno: 'Retorno',
};

const PRIORITIES = {
  alta: { label: 'Prioridade Alta', color: '#ef4444' },
  media: { label: 'Prioridade Media', color: '#3b82f6' },
  baixa: { label: 'Prioridade Baixa', color: '#eab308' },
};

const RETURN_REASONS = [
  'Endereco invalido',
  'Cliente recusou',
  'Chip danificado',
  'Reprovado na operadora',
  'Cancelamento do cliente',
  'Outro motivo',
];

function parseDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(d) {
  return `${formatDate(d)} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function timeAgo(d) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atras`;
  if (hours < 24) return `${hours}h atras`;
  return `${days}d atras`;
}

function initials(name) {
  return String(name || 'SV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'SV';
}

function getClient(venda) {
  return venda.nome || venda.razao_social || `Venda #${venda.id}`;
}

function getOperator(venda) {
  return venda.operadora?.nome || venda.operadora || 'Sem operadora';
}

function getPlan(venda) {
  return venda.produto_fechado || venda.servico?.nome || venda.tipoVenda?.nome || 'Plano nao informado';
}

function mapVendaToSale(venda) {
  const sellerName = venda.vendedora?.nome || venda.nome_fechou_venda || 'Sem vendedor';
  const updated = parseDate(venda.ultima_atividade_em || venda.updated_at || venda.created_at);
  const created = parseDate(venda.criado_em || venda.created_at || venda.data_venda);
  const stage = venda.status_funil || 'aprovacao';

  return {
    raw: venda,
    id: venda.id,
    client: getClient(venda),
    value: Number(venda.valor_total || 0),
    operator: getOperator(venda),
    plan: getPlan(venda),
    cpfCnpj: venda.cnpj || venda.cpf || '-',
    seller: { name: sellerName, initials: initials(sellerName) },
    linha: venda.telefone || venda.quantidade_linhas || '-',
    iccid: venda.iccid || '-',
    endereco: [
      venda.endereco,
      venda.numero_endereco,
      venda.bairro,
      venda.municipio,
      venda.uf
    ].filter(Boolean).join(', ') || 'Endereco nao informado',
    stage,
    priority: 'media',
    lancadaEm: created,
    updated,
    historico: [
      { acao: `Status atual: ${STAGE_LABELS[stage] || stage}`, autor: 'Sistema', data: updated, tipo: 'move' },
      { acao: 'Venda cadastrada', autor: sellerName, data: created, tipo: 'create' },
    ],
  };
}

function SaleModal({ sale, onClose, onUpdateSale }) {
  const [tab, setTab] = useState('info');
  const [novaFase, setNovaFase] = useState(sale.stage);
  const [novaPrioridade, setNovaPrioridade] = useState(sale.priority || 'media');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const alterou = novaFase !== sale.stage || observacao.trim() !== '';

  async function submitStatus(status, statusObservacao = observacao.trim(), motivoRetorno = '') {
    setSaving(true);
    setError('');

    try {
      await onUpdateSale(sale.id, status, novaPrioridade, statusObservacao, motivoRetorno);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status.');
      setSaving(false);
    }
  }

  function handleAtualizar() {
    submitStatus(novaFase);
  }

  function handleConfirmRetorno({ motivo, observacao: observacaoRetorno }) {
    return submitStatus('retorno', observacaoRetorno, motivo);
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => !saving && e.target === e.currentTarget && onClose()}
    >
      {returnModalOpen && (
        <ReturnReasonModal
          sale={sale}
          saving={saving}
          onClose={() => setReturnModalOpen(false)}
          onConfirm={handleConfirmRetorno}
        />
      )}

      <div className="modal">
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
              <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
                <I.Close size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="modal-tabs">
          {[
            { id: 'info', label: 'Informacoes' },
            { id: 'historico', label: 'Historico' },
            { id: 'status', label: 'Atualizar status' },
          ].map(t => (
            <button
              type="button"
              key={t.id}
              className={`modal-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
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
                <div className="label">ENDERECO DE ENTREGA</div>
                <div className="value">{sale.endereco}</div>
              </div>
              <div className="detail-item">
                <div className="label">LANCADA EM</div>
                <div className="value">{formatDate(sale.lancadaEm)}</div>
              </div>
              <div className="detail-item">
                <div className="label">ATUALIZADA</div>
                <div className="value">{timeAgo(sale.updated)}</div>
              </div>
            </div>
          )}

          {tab === 'historico' && (
            <div className="sale-timeline">
              {sale.historico.map((item, i) => (
                <div key={i} className="sale-tl-item">
                  <div className={`sale-tl-dot ${item.tipo} ${i === 0 ? 'current' : ''}`}>
                    {i === 0 ? (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                    ) : (
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

          {tab === 'status' && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
                Mover esta venda para a fase
              </div>
              <div className="stage-selector">
                {STAGES.map(st => (
                  <button
                    type="button"
                    key={st.id}
                    className={`stage-chip ${novaFase === st.id ? 'active' : ''}`}
                    onClick={() => setNovaFase(st.id)}
                    disabled={saving}
                  >
                    {st.name}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                  Prioridade
                </div>
                <div className="stage-selector">
                  {Object.entries(PRIORITIES).map(([key, p]) => (
                    <button
                      type="button"
                      key={key}
                      className={`stage-chip ${novaPrioridade === key ? 'active' : ''}`}
                      onClick={() => setNovaPrioridade(key)}
                      disabled={saving}
                    >
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color, marginRight: 8 }}></span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                  Observacao (opcional)
                </div>
                <textarea
                  className="obs-textarea"
                  placeholder="Adicione um detalhe sobre essa atualizacao..."
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  disabled={saving}
                />
              </div>

              {error && <div className="alert-error" style={{ marginTop: 12 }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: 'var(--danger)', borderColor: '#fecaca' }}
                  onClick={() => setReturnModalOpen(true)}
                  disabled={saving}
                >
                  <I.AlertTriangle size={13} /> Marcar como retorno
                </button>
                {alterou && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAtualizar} disabled={saving}>
                    {saving ? 'Salvando...' : 'Confirmar mudanca'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function ReturnReasonModal({ sale, saving, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!motivo) {
      setError('Selecione o motivo do retorno.');
      return;
    }

    setError('');
    await onConfirm({ motivo, observacao: observacao.trim() });
  }

  return (
    <div
      className="modal-overlay"
      onClick={event => !saving && event.target === event.currentTarget && onClose()}
      style={{ zIndex: 60 }}
    >
      <form className="modal return-status-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Motivo do retorno</div>
              <div className="modal-sub">{sale.client} · #{sale.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            Por que esse chip retornou?
          </div>
          <div className="stage-selector">
            {RETURN_REASONS.map(reason => (
              <button
                type="button"
                key={reason}
                className={`stage-chip ${motivo === reason ? 'active' : ''}`}
                onClick={() => setMotivo(reason)}
                disabled={saving}
              >
                {reason}
              </button>
            ))}
          </div>

          <div className="form-field" style={{ marginTop: 20 }}>
            <label>Observacao</label>
            <textarea
              className="obs-textarea"
              placeholder="Ex: cliente recusou por endereco divergente, confirmar novo envio."
              value={observacao}
              onChange={event => setObservacao(event.target.value)}
              disabled={saving}
              rows={4}
            />
          </div>

          {error && <div className="alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !motivo}>
            {saving ? 'Salvando...' : 'Confirmar retorno'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SaleCard({ sale, onClick }) {
  const priorityColor = PRIORITIES[sale.priority || 'media']?.color || '#3b82f6';
  return (
    <div className="sale-card" onClick={onClick}>
      <div className="sale-card-top">
        <div className="client" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: priorityColor, flexShrink: 0 }}></span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sale.client}
          </span>
        </div>
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
          <span>#{sale.id}</span>
        </span>
        <span style={{ fontSize: '10px' }}>{timeAgo(sale.updated)}</span>
      </div>
    </div>
  );
}

function FunilPage() {
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function carregarVendas() {
    setLoading(true);
    setError('');

    try {
      const vendas = await listarVendas();
      setSales(Array.isArray(vendas) ? vendas.map(mapVendaToSale) : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar funil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarVendas();
  }, []);

  async function handleUpdateSale(saleId, novaFase, novaPrioridade, observacao, motivoRetorno) {
    if (novaFase === 'retorno') {
      const motivo = [motivoRetorno, observacao].filter(Boolean).join(' - ');

      await atualizarStatusVenda(saleId, {
        status_funil: 'retorno',
        motivo_retorno: motivo
      });

      setSales(prev => prev.filter(sale => sale.id !== saleId));
      return;
    }

    const vendaAtualizada = await atualizarStatusVenda(saleId, {
      status_funil: novaFase
    });

    setSales(prev => prev.map(sale => {
      if (sale.id !== saleId) return sale;
      return {
        ...sale,
        ...mapVendaToSale(vendaAtualizada),
        priority: novaPrioridade,
        historico: [
          ...(novaFase !== sale.stage ? [{ acao: `Movido para ${STAGE_LABELS[novaFase] || novaFase}`, autor: 'Voce', data: new Date(), tipo: 'move' }] : []),
          ...(observacao ? [{ acao: observacao, autor: 'Voce', data: new Date(), tipo: 'obs' }] : []),
          ...sale.historico
        ]
      };
    }));
  }

  const filtradas = sales.filter(
    s => s.stage !== 'retorno' && (filter === 'todas' || s.operator === filter)
  );
  const total = filtradas.reduce((sum, s) => sum + s.value, 0);
  const selectedSale = selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null;
  const operators = useMemo(
    () => Array.from(new Set([...OPERATORS, ...sales.map(sale => sale.operator)])).filter(Boolean),
    [sales]
  );

  return (
    <LayoutPrivado>
      {selectedSale && (
        <SaleModal
          sale={selectedSale}
          onClose={() => setSelectedSaleId(null)}
          onUpdateSale={handleUpdateSale}
        />
      )}

      <div className="page">
        <div className="filters">
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4 }}>Operadora:</span>
          {['todas', ...operators].map(op => (
            <button
              type="button"
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

        {error && <div className="alert-error" style={{ margin: 16 }}>{error}</div>}

        <div className="kanban">
          {STAGES.map(st => {
            const priorityWeight = { alta: 1, media: 2, baixa: 3 };
            const items = filtradas
              .filter(s => s.stage === st.id)
              .sort((a, b) => {
                const wA = priorityWeight[a.priority || 'media'];
                const wB = priorityWeight[b.priority || 'media'];
                if (wA !== wB) return wA - wB;
                return b.updated.getTime() - a.updated.getTime();
              });
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
                  {loading ? (
                    <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                      Carregando...
                    </div>
                  ) : items.length === 0 ? (
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

export default FunilPage;
