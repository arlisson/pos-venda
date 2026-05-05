import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { DEFAULT_OPERATORS as OPERATORS, STAGES as FALLBACK_STAGES } from '../../config/constants';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarEtapaFunil,
  criarEtapaFunil,
  excluirEtapaFunil,
  listarEtapasFunil,
  listarEtapasFunilAdmin
} from '../../services/config.service';
import { atualizarStatusVenda, gerarEmailVenda, listarVendas } from '../../services/venda.service';

const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STAGE_LABELS = {
  ...Object.fromEntries(FALLBACK_STAGES.map(stage => [stage.id, stage.name])),
  retorno: 'Retorno',
};

function EmailTemplateModal({ dados, copiando, onClose, onCopy }) {
  if (!dados) return null;

  return (
    <div className="modal-overlay" onClick={event => !copiando && event.target === event.currentTarget && onClose()}>
      <div className="modal venda-email-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Corpo do email</div>
              <div className="modal-sub">{dados.operadora} - {dados.venda?.cliente?.nome || dados.venda?.nome || `Venda #${dados.venda?.id}`}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={copiando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="venda-email-container">
            <textarea className="venda-email-preview" value={dados.texto || ''} readOnly />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={copiando}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={onCopy} disabled={copiando}>
            {copiando ? 'Copiando...' : 'Copiar e-mail'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizarAtivo(valor) {
  if (typeof valor === 'string') {
    return !['0', 'false'].includes(valor.trim().toLowerCase());
  }

  return ![false, 0].includes(valor);
}

function normalizarEtapasFunil(etapas = [], usarFallback = true) {
  const normalizadas = etapas
    .map((etapa, index) => ({
      id: etapa.codigo || etapa.id,
      adminId: etapa.id,
      name: etapa.nome || etapa.name,
      dot: etapa.codigo || etapa.id || `etapa_${index}`,
      ordem: Number(etapa.ordem ?? index),
      ativo: normalizarAtivo(etapa.ativo),
      etapaFinal: Boolean(etapa.etapa_final || etapa.etapaFinal)
    }))
    .filter(etapa => etapa.id && etapa.name);

  return normalizadas.length > 0 || !usarFallback ? normalizadas : FALLBACK_STAGES;
}

function montarStageLabels(stages = []) {
  return {
    ...STAGE_LABELS,
    ...Object.fromEntries(stages.map(stage => [stage.id, stage.name]))
  };
}

const PRIORITIES = {
  alta: { label: 'Prioridade Alta', color: '#ef4444' },
  media: { label: 'Prioridade Média', color: '#3b82f6' },
  baixa: { label: 'Prioridade Baixa', color: '#eab308' },
};

const RETURN_REASONS = [
  'Endereço inválido',
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
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
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

function SellerAvatar({ seller, className = 'mini-avatar' }) {
  return (
    <span className={className}>
      {seller?.photo ? (
        <img src={seller.photo} alt={seller.name || 'Foto do vendedor'} />
      ) : (
        seller?.initials || initials(seller?.name)
      )}
    </span>
  );
}

function getClient(venda) {
  return venda.nome || venda.razao_social || `Venda #${venda.id}`;
}

function getOperator(venda) {
  return venda.operadora?.nome || venda.operadora || 'Sem operadora';
}

function getPlan(venda) {
  return venda.produto_fechado || venda.servico?.nome || venda.tipoVenda?.nome || 'Plano não informado';
}

function getSellerPhoto(venda) {
  return venda.vendedora?.foto_perfil
    || venda.vendedora?.fotoPerfil
    || venda.vendedora_foto_perfil
    || venda.foto_perfil_vendedora
    || '';
}

function getHistoryAuthor(item) {
  return item.usuario?.nome || (item.usuario_id ? `Usuário #${item.usuario_id}` : 'Sistema');
}

function getHistoryLabel(item, stageLabels = STAGE_LABELS) {
  if (item.acao === 'venda.criada') return 'Venda cadastrada';
  if (item.acao === 'venda.retorno_registrado') {
    return ['Marcada como retorno', item.observacao].filter(Boolean).join(' - ');
  }
  if (item.acao === 'venda.retorno_corrigido') {
    return ['Retorno corrigido', item.observacao].filter(Boolean).join(' - ');
  }
  if (item.acao === 'venda.observacao_adicionada') {
    return ['Observação adicionada', item.observacao].filter(Boolean).join(' - ');
  }
  if (item.acao === 'venda.prioridade_atualizada') {
    return ['Prioridade atualizada', item.observacao].filter(Boolean).join(' - ');
  }

  if (item.acao === 'venda.status_atualizado') {
    return [
      `Movido para ${stageLabels[item.status_novo] || item.status_novo}`,
      item.observacao
    ].filter(Boolean).join(' - ');
  }

  if (item.observacao) return item.observacao;

  return item.acao || 'Atualização registrada';
}

function getHistoryType(item) {
  if (item.acao === 'venda.criada') return 'create';
  if (item.acao === 'venda.observacao_adicionada') return 'obs';
  return 'move';
}

function mapHistoricoVenda(venda, stage, updated, created, sellerName, stageLabels = STAGE_LABELS) {
  const historico = Array.isArray(venda.historico) ? venda.historico : [];

  if (historico.length === 0) {
    return [
      { acao: `Status atual: ${stageLabels[stage] || stage}`, autor: 'Sistema', data: updated, tipo: 'move' },
      { acao: 'Venda cadastrada', autor: sellerName, data: created, tipo: 'create' },
    ];
  }

  return historico.map(item => ({
    acao: getHistoryLabel(item, stageLabels),
    autor: getHistoryAuthor(item),
    data: parseDate(item.created_at),
    tipo: getHistoryType(item)
  }));
}

function mapVendaToSale(venda, stageLabels = STAGE_LABELS) {
  const sellerName = venda.vendedora?.nome || 'Sem vendedor';
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
    seller: { name: sellerName, initials: initials(sellerName), photo: getSellerPhoto(venda) },
    linha: venda.telefone || venda.quantidade_linhas || '-',
    iccid: venda.iccid || '-',
    endereco: [
      venda.endereco,
      venda.numero_endereco,
      venda.bairro,
      venda.municipio,
      venda.uf
    ].filter(Boolean).join(', ') || 'Endereço não informado',
    stage,
    priority: venda.prioridade_funil || 'media',
    lancadaEm: created,
    updated,
    historico: mapHistoricoVenda(venda, stage, updated, created, sellerName, stageLabels),
  };
}

function SaleModal({ sale, stages, stageLabels, onClose, onUpdateSale }) {
  const [tab, setTab] = useState('info');
  const [novaFase, setNovaFase] = useState(sale.stage);
  const [novaPrioridade, setNovaPrioridade] = useState(sale.priority || 'media');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const alterou = novaFase !== sale.stage
    || novaPrioridade !== (sale.priority || 'media')
    || observacao.trim() !== '';

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
                {stageLabels[sale.stage] || sale.stage}
              </span>
              <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
                <I.Close size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="modal-tabs">
          {[
            { id: 'info', label: 'Informações' },
            { id: 'historico', label: 'Histórico' },
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
                  <SellerAvatar seller={sale.seller} className="seller-detail-avatar" />
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
                {stages.map(st => (
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
                  Observação (opcional)
                </div>
                <textarea
                  className="obs-textarea"
                  placeholder="Adicione um detalhe sobre essa atualização..."
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
                    {saving ? 'Salvando...' : 'Confirmar mudança'}
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
            <label>Observação</label>
            <textarea
              className="obs-textarea"
              placeholder="Ex: cliente recusou por endereço divergente, confirmar novo envio."
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

function DeleteStageModal({ stage, saving, onClose, onConfirm }) {
  const vendasCount = Number(stage?.vendasCount || 0);

  return (
    <div
      className="modal-overlay"
      onClick={event => !saving && event.target === event.currentTarget && onClose()}
    >
      <div className="modal delete-stage-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Excluir etapa</div>
              <div className="modal-sub">{stage?.name || stage?.nome}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <p className="delete-stage-text">
            Tem certeza que deseja excluir esta etapa do funil?
          </p>
          {vendasCount === 0 ? (
            <div className="alert-success">
              Esta etapa nao possui vendas e sera excluida definitivamente.
            </div>
          ) : (
            <div className="alert-error">
              Existem {vendasCount} venda{vendasCount === 1 ? '' : 's'} nessa etapa. Por isso, ela sera apenas desativada, continuara aparecendo no funil e deixara de ser um destino valido para vendas.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={saving}>
            {saving ? 'Processando...' : vendasCount === 0 ? 'Excluir etapa' : 'Desativar etapa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaleCard({ sale, onClick, onEmail, gerandoEmailId }) {
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
          <SellerAvatar seller={sale.seller} />
          <span className="seller-name">{sale.seller.name}</span>
          <span>#{sale.id}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-icon btn-ghost"
            title="Gerar corpo de email"
            disabled={gerandoEmailId === sale.id}
            onClick={(e) => {
              e.stopPropagation();
              onEmail(sale.raw);
            }}
            style={{ padding: 4, height: 24, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {gerandoEmailId === sale.id ? (
              <div className="spinner-small" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <I.Note size={12} />
            )}
          </button>
          <span style={{ fontSize: '10px' }}>{timeAgo(sale.updated)}</span>
        </div>
      </div>
    </div>
  );
}

const NOVA_ETAPA = {
  nome: '',
  ordem: 0,
  ativo: true,
  etapa_final: false
};

function FunilPage() {
  const usuario = getUsuarioLocal();
  const podeGerenciarEtapas = temPermissao(usuario, 'crud_funil_etapas');
  const [sales, setSales] = useState([]);
  const [stages, setStages] = useState(FALLBACK_STAGES);
  const [adminStages, setAdminStages] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stageSavingId, setStageSavingId] = useState(null);
  const [creatingStage, setCreatingStage] = useState(false);
  const [newStage, setNewStage] = useState(NOVA_ETAPA);
  const [editStageNames, setEditStageNames] = useState({});
  const [showNewStageForm, setShowNewStageForm] = useState(false);
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [error, setError] = useState('');
  const [stageFeedback, setStageFeedback] = useState({ type: '', message: '' });

  const [emailTemplate, setEmailTemplate] = useState(null);
  const [gerandoEmailId, setGerandoEmailId] = useState(null);
  const [copiandoEmail, setCopiandoEmail] = useState(false);

  async function abrirEmailVenda(venda) {
    if (!venda?.id) return;
    setGerandoEmailId(venda.id);

    try {
      const resultado = await gerarEmailVenda(venda.id);
      setEmailTemplate({ ...resultado, venda });
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao gerar corpo de email.' });
    } finally {
      setGerandoEmailId(null);
    }
  }

  async function copiarEmailVenda() {
    if (!emailTemplate?.texto) return;

    setCopiandoEmail(true);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(emailTemplate.texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = emailTemplate.texto;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setStageFeedback({ type: 'success', message: 'Corpo do email copiado.' });
      setEmailTemplate(null);
    } catch {
      setStageFeedback({ type: 'error', message: 'Erro ao copiar email.' });
    } finally {
      setCopiandoEmail(false);
    }
  }

  function sincronizarEtapas(etapas, { atualizarAdmin = false, fallbackAdminEtapa = null } = {}) {
    const etapasNormalizadas = normalizarEtapasFunil(etapas, !atualizarAdmin);
    const etapasComFallback = fallbackAdminEtapa
      ? [
        ...etapasNormalizadas.filter(etapa => etapa.adminId !== fallbackAdminEtapa.adminId),
        fallbackAdminEtapa
      ].sort((a, b) => {
        if (a.ordem !== b.ordem) return a.ordem - b.ordem;
        return a.name.localeCompare(b.name);
      })
      : etapasNormalizadas;

    setStages(etapasComFallback.length > 0 || atualizarAdmin ? etapasComFallback : FALLBACK_STAGES);

    if (atualizarAdmin) {
      setAdminStages(etapasComFallback);
      setEditStageNames(Object.fromEntries(etapasComFallback.map(etapa => [etapa.adminId, etapa.name])));
    }

    return montarStageLabels(etapasComFallback);
  }

  async function carregarEtapasAdmin(fallbackAdminEtapa = null) {
    if (!podeGerenciarEtapas) return;

    setStagesLoading(true);
    try {
      const etapas = await listarEtapasFunilAdmin();
      sincronizarEtapas(etapas, { atualizarAdmin: true, fallbackAdminEtapa });
    } catch (err) {
      if (fallbackAdminEtapa) {
        sincronizarEtapas([...adminStages, fallbackAdminEtapa], { atualizarAdmin: true });
      } else {
        setStageFeedback({ type: 'error', message: err.message || 'Erro ao carregar etapas do funil.' });
      }
    } finally {
      setStagesLoading(false);
    }
  }

  async function carregarVendas() {
    setLoading(true);
    setError('');

    try {
      const [vendas, etapas] = await Promise.all([
        listarVendas(),
        podeGerenciarEtapas ? listarEtapasFunilAdmin() : listarEtapasFunil()
      ]);
      const labels = sincronizarEtapas(etapas, { atualizarAdmin: podeGerenciarEtapas });
      setSales(Array.isArray(vendas) ? vendas.map(venda => mapVendaToSale(venda, labels)) : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar funil.');
    } finally {
      setLoading(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarVendas();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!stageFeedback.message) return undefined;
    const timer = setTimeout(() => setStageFeedback({ type: '', message: '' }), 5000);
    return () => clearTimeout(timer);
  }, [stageFeedback.message]);

  async function atualizarEtapasAposCrud(message, fallbackAdminEtapa = null) {
    await carregarEtapasAdmin(fallbackAdminEtapa);
    setStageFeedback({ type: 'success', message });
  }

  async function handleCreateStage(event) {
    event.preventDefault();

    if (!newStage.nome.trim()) return;

    setCreatingStage(true);
    setStageFeedback({ type: '', message: '' });

    try {
      await criarEtapaFunil({
        ...newStage,
        nome: newStage.nome.trim(),
        ordem: Number(newStage.ordem || 0)
      });
      setNewStage(NOVA_ETAPA);
      setShowNewStageForm(false);
      await atualizarEtapasAposCrud('Etapa adicionada com sucesso.');
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao adicionar etapa.' });
    } finally {
      setCreatingStage(false);
    }
  }

  async function handleSaveStageName(stage) {
    const nome = editStageNames[stage.adminId]?.trim();
    if (!stage.adminId || !nome || nome === stage.name) return;

    setStageSavingId(stage.adminId);
    setStageFeedback({ type: '', message: '' });

    try {
      await atualizarEtapaFunil(stage.adminId, {
        nome,
        ordem: Number(stage.ordem || 0),
        ativo: stage.ativo,
        etapa_final: stage.etapaFinal
      });
      setEditingStageId(null);
      await atualizarEtapasAposCrud('Nome da etapa atualizado.');
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao atualizar etapa.' });
    } finally {
      setStageSavingId(null);
    }
  }

  async function handleToggleStage(stage) {
    if (!stage.adminId) return;

    const proximoAtivo = !stage.ativo;
    setStageSavingId(stage.adminId);
    setStageFeedback({ type: '', message: '' });

    try {
      await atualizarEtapaFunil(stage.adminId, {
        nome: editStageNames[stage.adminId]?.trim() || stage.name,
        ordem: Number(stage.ordem || 0),
        ativo: proximoAtivo,
        etapa_final: stage.etapaFinal
      });
      await atualizarEtapasAposCrud(proximoAtivo ? 'Etapa reativada.' : 'Etapa desativada.');
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao alterar status da etapa.' });
    } finally {
      setStageSavingId(null);
    }
  }

  async function handleDeleteStage(stage) {
    if (!stage.adminId) return;

    setStageSavingId(stage.adminId);
    setStageFeedback({ type: '', message: '' });

    try {
      const resultado = await excluirEtapaFunil(stage.adminId);
      const etapaFallback = resultado?.acao === 'desativada' && resultado?.etapa
        ? normalizarEtapasFunil([resultado.etapa], false)[0]
        : null;
      setEditingStageId(null);
      setStageToDelete(null);
      await atualizarEtapasAposCrud(
        resultado?.acao === 'desativada'
          ? 'Etapa desativada porque possui vendas vinculadas. Ela continuara visivel no funil.'
          : 'Etapa excluida com sucesso.',
        etapaFallback
      );
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao excluir etapa.' });
    } finally {
      setStageSavingId(null);
    }
  }

  async function handleToggleFinalStage(stage) {
    if (!stage.adminId) return;

    setStageSavingId(stage.adminId);
    setStageFeedback({ type: '', message: '' });

    try {
      await atualizarEtapaFunil(stage.adminId, {
        nome: editStageNames[stage.adminId]?.trim() || stage.name,
        ordem: Number(stage.ordem || 0),
        ativo: stage.ativo,
        etapa_final: !stage.etapaFinal
      });
      await atualizarEtapasAposCrud(!stage.etapaFinal ? 'Etapa final definida.' : 'Etapa deixou de ser final.');
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao definir etapa final.' });
    } finally {
      setStageSavingId(null);
    }
  }

  async function handleUpdateSale(saleId, novaFase, novaPrioridade, observacao, motivoRetorno) {
    if (novaFase === 'retorno') {
      await atualizarStatusVenda(saleId, {
        status_funil: 'retorno',
        prioridade_funil: novaPrioridade,
        motivo_retorno: motivoRetorno,
        observacao
      });

      setSales(prev => prev.filter(sale => sale.id !== saleId));
      return;
    }

    const vendaAtualizada = await atualizarStatusVenda(saleId, {
      status_funil: novaFase,
      prioridade_funil: novaPrioridade,
      observacao
    });

    setSales(prev => prev.map(sale => {
      if (sale.id !== saleId) return sale;
      return {
        ...sale,
        ...mapVendaToSale(vendaAtualizada, stageLabels)
      };
    }));
  }

  const filtradas = sales.filter(
    s => s.stage !== 'retorno' && (filter === 'todas' || s.operator === filter)
  );
  const total = filtradas.reduce((sum, s) => sum + s.value, 0);
  const selectedSale = selectedSaleId ? sales.find(s => s.id === selectedSaleId) : null;
  const adminStagesByCode = useMemo(
    () => new Map(adminStages.map(stage => [stage.id, stage])),
    [adminStages]
  );
  const inactiveStages = useMemo(
    () => adminStages.filter(stage => stage.ativo === false),
    [adminStages]
  );
  const stagesVisiveis = useMemo(() => {
    const conhecidos = new Set(stages.map(stage => stage.id));
    const extras = Array.from(new Set(
      sales
        .map(sale => sale.stage)
        .filter(stage => stage && stage !== 'retorno' && !conhecidos.has(stage))
    ));

    return [
      ...stages,
      ...extras.map(stage => ({ id: stage, name: STAGE_LABELS[stage] || stage, dot: stage }))
    ];
  }, [sales, stages]);
  const stagesValidas = useMemo(
    () => stagesVisiveis.filter(stage => stage.ativo !== false),
    [stagesVisiveis]
  );
  const stageLabels = montarStageLabels(stagesVisiveis);
  const operators = useMemo(
    () => Array.from(new Set([...OPERATORS, ...sales.map(sale => sale.operator)])).filter(Boolean),
    [sales]
  );

  return (
    <LayoutPrivado>
      {selectedSale && (
        <SaleModal
          sale={selectedSale}
          stages={stagesValidas}
          stageLabels={stageLabels}
          onClose={() => setSelectedSaleId(null)}
          onUpdateSale={handleUpdateSale}
        />
      )}
      {stageToDelete && (
        <DeleteStageModal
          stage={stageToDelete}
          saving={stageSavingId === stageToDelete.adminId}
          onClose={() => setStageToDelete(null)}
          onConfirm={() => handleDeleteStage(stageToDelete)}
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
        {podeGerenciarEtapas && (
          <>
            {stageFeedback.message && (
              <div
                className={stageFeedback.type === 'success' ? 'alert-success alert-timed alert-timed--success' : 'alert-error alert-timed alert-timed--error'}
                style={{ margin: '12px 24px 0' }}
              >
                {stageFeedback.message}
              </div>
            )}
            <div className="funnel-stage-toolbar">
              {!showNewStageForm ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNewStageForm(true)}>
                  <I.Plus size={13} /> Nova etapa
                </button>
              ) : (
                <form className="funnel-stage-form" onSubmit={handleCreateStage}>
                  <input
                    value={newStage.nome}
                    onChange={event => setNewStage({ ...newStage, nome: event.target.value })}
                    placeholder="Nome da nova etapa"
                    disabled={creatingStage}
                    required
                  />
                  <input
                    className="funnel-stage-form__order"
                    type="number"
                    value={newStage.ordem}
                    onChange={event => setNewStage({ ...newStage, ordem: event.target.value })}
                    disabled={creatingStage}
                    aria-label="Ordem da nova etapa"
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={newStage.etapa_final}
                      onChange={event => setNewStage({ ...newStage, etapa_final: event.target.checked })}
                      disabled={creatingStage}
                    />
                    Etapa final
                  </label>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={creatingStage || !newStage.nome.trim()}>
                    {creatingStage ? 'Adicionando...' : 'Adicionar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setNewStage(NOVA_ETAPA);
                      setShowNewStageForm(false);
                    }}
                    disabled={creatingStage}
                  >
                    Cancelar
                  </button>
                </form>
              )}
              {stagesLoading && <span className="muted" style={{ fontSize: 12 }}>Atualizando etapas...</span>}
            </div>
            {inactiveStages.length > 0 && (
              <div className="inactive-stage-bar">
                <span className="inactive-stage-bar__label">Etapas desativadas</span>
                {inactiveStages.map(stage => (
                  <button
                    type="button"
                    key={stage.adminId}
                    className="btn btn-sm"
                    onClick={() => handleToggleStage(stage)}
                    disabled={stageSavingId === stage.adminId}
                    title={`Reativar ${stage.name}`}
                  >
                    <I.Check size={12} />
                    {stageSavingId === stage.adminId ? 'Reativando...' : stage.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="kanban">
          {stagesVisiveis.map(st => {
            const editableStage = adminStagesByCode.get(st.id) || st;
            const canEditStage = podeGerenciarEtapas && editableStage.adminId;
            const isEditingStage = canEditStage && editingStageId === editableStage.adminId;
            const stageSaving = canEditStage && stageSavingId === editableStage.adminId;
            const editValue = canEditStage ? (editStageNames[editableStage.adminId] ?? editableStage.name) : st.name;
            const editChanged = canEditStage && editValue.trim() && editValue.trim() !== editableStage.name;
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
                    {isEditingStage ? (
                      <input
                        className="column-name-input"
                        value={editValue}
                        onChange={event => setEditStageNames(prev => ({ ...prev, [editableStage.adminId]: event.target.value }))}
                        disabled={stageSaving}
                        autoFocus
                        aria-label={`Editar nome da etapa ${editableStage.name}`}
                      />
                    ) : (
                      <span className="column-name">
                        {st.name}
                        {st.etapaFinal && <span className="tag" style={{ marginLeft: 6 }}>Final</span>}
                      </span>
                    )}
                    <span className="column-count">{items.length}</span>
                    {canEditStage && !isEditingStage && (
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost column-edit-btn"
                        onClick={() => {
                          setEditingStageId(editableStage.adminId);
                          setEditStageNames(prev => ({ ...prev, [editableStage.adminId]: editableStage.name }));
                        }}
                        title="Editar etapa"
                      >
                        <I.Edit size={12} />
                      </button>
                    )}
                  </div>
                  {isEditingStage && (
                    <div className="column-stage-actions">
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost"
                        onClick={() => handleSaveStageName(editableStage)}
                        disabled={stageSaving || !editChanged}
                        title="Salvar nome"
                      >
                        <I.Check size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost"
                        onClick={() => {
                          setEditingStageId(null);
                          setEditStageNames(prev => ({ ...prev, [editableStage.adminId]: editableStage.name }));
                        }}
                        disabled={stageSaving}
                        title="Cancelar edicao"
                      >
                        <I.Close size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleToggleFinalStage(editableStage)}
                        disabled={stageSaving}
                      >
                        {editableStage.etapaFinal ? 'Remover final' : 'Etapa final'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleToggleStage(editableStage)}
                        disabled={stageSaving}
                      >
                        {editableStage.ativo === false ? 'Reativar' : 'Desativar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-danger-icon"
                        onClick={() => setStageToDelete({ ...editableStage, vendasCount: items.length })}
                        disabled={stageSaving}
                        title="Excluir etapa"
                      >
                        <I.Trash size={13} />
                      </button>
                    </div>
                  )}
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
                      <SaleCard
                        key={s.id}
                        sale={s}
                        onClick={() => setSelectedSaleId(s.id)}
                        onEmail={abrirEmailVenda}
                        gerandoEmailId={gerandoEmailId}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EmailTemplateModal
        dados={emailTemplate}
        copiando={copiandoEmail}
        onClose={() => setEmailTemplate(null)}
        onCopy={copiarEmailVenda}
      />
    </LayoutPrivado>
  );
}

export default FunilPage;
