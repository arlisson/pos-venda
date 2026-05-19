import { useEffect, useMemo, useRef, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { DEFAULT_OPERATORS as OPERATORS, STAGES as FALLBACK_STAGES } from '../../config/constants';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import ClienteModal from '../Clientes/ClienteModal';
import VendaModal from '../VendasPage/VendaModal';
import {
  WhatsappMensagemModal,
  montarChecklistWhatsappVenda,
  obterDocumentosFaltantesPadrao
} from '../VendasPage/VendasPage';
import {
  atualizarEtapaFunil,
  criarEtapaFunil,
  excluirEtapaFunil,
  listarEtapasFunil,
  listarEtapasFunilAdmin,
  listarOperadoras,
  listarServicos,
  listarTiposVenda
} from '../../services/config.service';
import { listarClientes } from '../../services/cliente.service';
import {
  atualizarStatusVenda,
  cancelarVenda,
  reverterCancelamentoVenda,
  atualizarVenda,
  baixarXlsxClaro,
  buscarVendaPorId,
  enviarVendaParaPosVenda,
  gerarEmailVenda,
  listarVendas,
  listarVendedoras
} from '../../services/venda.service';
import { parseUtcDateTime } from '../../utils/datetime';
import '../VendasPage/VendasPage.css';

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
  if (!value) return new Date();
  // Strings do banco vêm em UTC ("YYYY-MM-DD HH:MM:SS"); adiciona Z para evitar
  // interpretação como horário local do browser.
  return parseUtcDateTime(value) || new Date();
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

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function montarTextoBuscaVenda(sale) {
  const raw = sale.raw || {};
  const campos = [
    sale.id,
    sale.client,
    sale.operator,
    sale.plan,
    sale.cpfCnpj,
    sale.seller?.name,
    sale.linha,
    sale.endereco,
    sale.stage,
    sale.priority,
    formatBRL(sale.value),
    raw.nome,
    raw.razao_social,
    raw.email,
    raw.email_2,
    raw.telefone,
    raw.fixo_ddd,
    raw.cnpj,
    raw.protocolo,
    raw.login,
    raw.municipio,
    raw.uf,
    raw.bairro,
    raw.cep,
    raw.produto_fechado,
    raw.gb,
    raw.ddd,
    raw.quantidade_linhas,
    raw.dia_vencimento,
    raw.observacoes,
    raw.operadora?.nome,
    raw.tipoVenda?.nome,
    raw.servico?.nome,
    raw.vendedora?.nome,
    ...(Array.isArray(raw.vendedoras) ? raw.vendedoras.map(item => item?.nome) : []),
    raw.cliente?.nome,
    raw.cliente?.razao_social,
    raw.cliente?.email
  ];

  return normalizarBusca(campos.filter(Boolean).join(' '));
}

function vendaCorrespondeBusca(sale, busca) {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;

  const texto = montarTextoBuscaVenda(sale);
  return termos.every(termo => texto.includes(termo));
}

function getChaveClienteVenda(venda = {}) {
  if (venda.cliente_id) return `cliente:${venda.cliente_id}`;
  if (venda.cliente?.id) return `cliente:${venda.cliente.id}`;

  const cnpj = String(venda.cnpj || venda.cliente?.cnpj || '').replace(/\D/g, '');
  if (cnpj) return `cnpj:${cnpj}`;

  const nome = normalizarBusca(venda.nome || venda.cliente?.nome || venda.razao_social || venda.cliente?.razao_social || '');
  return nome ? `nome:${nome}` : '';
}

function contarVendasPorCliente(vendas = []) {
  return vendas.reduce((acc, venda) => {
    const chave = getChaveClienteVenda(venda);
    if (!chave) return acc;
    acc.set(chave, (acc.get(chave) || 0) + 1);
    return acc;
  }, new Map());
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

function getSellerPhotoFromUser(usuario = {}) {
  return usuario.foto_perfil
    || usuario.fotoPerfil
    || usuario.vendedora_foto_perfil
    || usuario.foto_perfil_vendedora
    || '';
}

function getSellers(venda = {}) {
  const vendedoras = Array.isArray(venda.vendedoras) && venda.vendedoras.length > 0
    ? venda.vendedoras
    : [venda.vendedora].filter(Boolean);

  const sellers = vendedoras
    .map(item => {
      const name = item?.nome || item?.name || '';

      return {
        id: item?.id || item?.usuario_id || item?.vendedora_id || name,
        name: name || 'Sem vendedor',
        initials: initials(name || 'Sem vendedor'),
        photo: getSellerPhotoFromUser(item)
      };
    })
    .filter(item => item.name);

  if (sellers.length > 0) return sellers;

  const sellerName = venda.vendedora?.nome || 'Sem vendedor';
  return [{
    id: venda.vendedora_id || sellerName,
    name: sellerName,
    initials: initials(sellerName),
    photo: getSellerPhoto(venda)
  }];
}

function getHistoryAuthor(item) {
  return item.usuario?.nome || (item.usuario_id ? `Usuário #${item.usuario_id}` : 'Sistema');
}

function getHistoryTitle(item, stageLabels = STAGE_LABELS) {
  if (item.acao === 'venda.criada') return 'Venda cadastrada';
  if (item.acao === 'venda.retorno_registrado') return 'Marcada como retorno';
  if (item.acao === 'venda.retorno_corrigido') return 'Retorno corrigido';
  if (item.acao === 'venda.observacao_adicionada') return 'Observação adicionada';
  if (item.acao === 'venda.cancelada') return 'Venda cancelada';
  if (item.acao === 'venda.cancelamento_revertido') return 'Cancelamento revertido';
  if (item.acao === 'venda.prioridade_atualizada') return 'Prioridade atualizada';
  if (item.acao === 'venda.status_atualizado') {
    return `Movido para ${stageLabels[item.status_novo] || item.status_novo}`;
  }
  return item.acao || 'Atualização registrada';
}

function getHistoryLabel(item, stageLabels = STAGE_LABELS) {
  return [getHistoryTitle(item, stageLabels), item.observacao].filter(Boolean).join(' - ');
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
    titulo: getHistoryTitle(item, stageLabels),
    acaoRaw: item.acao || null,
    observacao: item.observacao || null,
    autor: getHistoryAuthor(item),
    data: parseDate(item.created_at),
    tipo: getHistoryType(item),
    statusAnterior: item.status_anterior || null,
    statusNovo: item.status_novo || null
  }));
}

function getEtapasPuladas(item, stages) {
  if (item.tipo !== 'move' || !item.statusAnterior || !item.statusNovo) {
    return [];
  }

  if (item.statusAnterior === 'retorno' || item.statusNovo === 'retorno') {
    return [];
  }

  const origem = stages.findIndex(stage => stage.id === item.statusAnterior);
  const destino = stages.findIndex(stage => stage.id === item.statusNovo);

  if (origem < 0 || destino < 0 || destino <= origem + 1) {
    return [];
  }

  return stages.slice(origem + 1, destino);
}

function buildSaleDeliveryProgress(sale, stages) {
  const etapas = stages.filter(stage => stage.id !== 'retorno');
  const etapaAtualIndex = Math.max(0, etapas.findIndex(stage => stage.id === sale.stage));
  const reached = new Map();
  const skipped = new Set();

  sale.historico.forEach(item => {
    if (item.tipo === 'create' && etapas[0] && !reached.has(etapas[0].id)) {
      reached.set(etapas[0].id, { data: item.data, autor: item.autor });
    }

    if (item.statusNovo && etapas.some(stage => stage.id === item.statusNovo)) {
      reached.set(item.statusNovo, { data: item.data, autor: item.autor });
    }

    getEtapasPuladas(item, etapas).forEach(stage => skipped.add(stage.id));
  });

  if (sale.stage && etapas.some(stage => stage.id === sale.stage) && !reached.has(sale.stage)) {
    reached.set(sale.stage, { data: sale.updated, autor: 'Sistema' });
  }

  etapas.slice(0, etapaAtualIndex + 1).forEach((stage, index) => {
    if (!skipped.has(stage.id) && !reached.has(stage.id)) {
      reached.set(stage.id, { data: index === etapaAtualIndex ? sale.updated : null, autor: null });
    }
  });

  const progressStages = etapas.map((stage, index) => {
    const isSkipped = skipped.has(stage.id);
    const isReached = reached.has(stage.id);
    const isCurrent = stage.id === sale.stage;
    const status = isSkipped ? 'skipped' : isCurrent ? 'current' : isReached || index < etapaAtualIndex ? 'done' : 'pending';

    return {
      ...stage,
      status,
      ...reached.get(stage.id)
    };
  });

  return {
    stages: progressStages,
    skippedCount: skipped.size
  };
}

function getDeliveryConnectorType(stageA, stageB) {
  if (stageA.status === 'skipped' || stageB.status === 'skipped') return 'skip';
  if (
    ['done', 'current'].includes(stageA.status) &&
    ['done', 'current'].includes(stageB.status)
  ) return 'done';
  return 'pending';
}

function SaleEventItem({ item }) {
  const [aberto, setAberto] = useState(false);
  const isCancel = item.acaoRaw === 'venda.cancelada';
  const isRevert = item.acaoRaw === 'venda.cancelamento_revertido';
  const variant = isCancel ? 'cancel' : isRevert ? 'revert' : item.tipo || 'move';
  const icon = isCancel
    ? <I.AlertTriangle size={11} />
    : isRevert
      ? <I.Check size={11} />
      : variant === 'create'
        ? <I.Plus size={11} />
        : <I.ChevronDown size={11} />;
  const titulo = item.titulo || item.acao || 'Atualização';
  const temObservacao = Boolean(item.observacao);

  return (
    <li className={`sale-event-list__item sale-event-list__item--${variant}${aberto ? ' is-open' : ''}`}>
      <div className="sale-event-list__row">
        <span className="sale-event-list__icon">{icon}</span>
        <div className="sale-event-list__body">
          <div className="sale-event-list__head">
            <strong>{titulo}</strong>
            <span className="sale-event-list__date">
              {item.data ? formatDateTime(item.data) : ''}
            </span>
          </div>
          <div className="sale-event-list__author">por {item.autor}</div>
        </div>
        {temObservacao && (
          <button
            type="button"
            className="sale-event-list__toggle"
            onClick={() => setAberto(v => !v)}
            aria-expanded={aberto}
            title={aberto ? 'Ocultar comentário' : 'Ver comentário'}
          >
            <I.ChevronDown size={12} className={aberto ? 'is-rotated' : ''} />
          </button>
        )}
      </div>
      {temObservacao && aberto && (
        <div className="sale-event-list__comment">
          <div className="sale-event-list__comment-label">Comentário</div>
          <p className="sale-event-list__comment-text">{item.observacao}</p>
        </div>
      )}
    </li>
  );
}

function SaleEventList({ sale }) {
  const eventos = Array.isArray(sale.historico) ? sale.historico : [];

  if (eventos.length === 0) {
    return (
      <div className="sale-event-list sale-event-list--empty">
        Sem eventos registrados.
      </div>
    );
  }

  const ordenados = [...eventos].sort((a, b) => {
    const ta = a.data ? new Date(a.data).getTime() : 0;
    const tb = b.data ? new Date(b.data).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="sale-event-list">
      <div className="sale-event-list__title">Eventos da venda</div>
      <ol className="sale-event-list__items">
        {ordenados.map((item, idx) => (
          <SaleEventItem key={idx} item={item} />
        ))}
      </ol>
    </div>
  );
}

function SaleDeliveryTracker({ sale, stages, stageLabels }) {
  const progress = buildSaleDeliveryProgress(sale, stages);

  return (
    <div className="sale-delivery">
      <aside className="sale-delivery__summary">
        <strong title={sale.client}>{sale.client}</strong>
        <span>#{sale.id}</span>
        <span className="sale-delivery__stage-badge">{stageLabels[sale.stage] || sale.stage}</span>
        {progress.skippedCount > 0 && (
          <span className="sale-delivery__skip-badge">
            <I.AlertTriangle size={11} />
            {progress.skippedCount} pulada{progress.skippedCount > 1 ? 's' : ''}
          </span>
        )}
        <span className="sale-delivery__events">
          <I.ChevronDown size={12} />
          {sale.historico.length} eventos
        </span>
      </aside>

      <div className="sale-delivery__track" role="list" aria-label={`Acompanhamento da venda ${sale.id}`}>
        {progress.stages.map((stage, index) => {
          const connectorType = index < progress.stages.length - 1
            ? getDeliveryConnectorType(stage, progress.stages[index + 1])
            : null;

          return (
            <div
              key={stage.id}
              className={`sale-delivery__step sale-delivery__step--${stage.status}`}
              data-connector={connectorType}
              role="listitem"
            >
              <div className="sale-delivery__dot">
                {stage.status === 'skipped' ? (
                  <I.AlertTriangle size={11} />
                ) : ['done', 'current'].includes(stage.status) ? (
                  <I.Check size={11} />
                ) : (
                  <span />
                )}
              </div>
              <strong>{stage.name}</strong>
              <small>{stage.data ? formatDateTime(stage.data) : ''}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function mapVendaToSale(venda, stageLabels = STAGE_LABELS) {
  const sellers = getSellers(venda);
  const seller = sellers[0];
  const sellerName = sellers.map(item => item.name).join(', ') || 'Sem vendedor';
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
    seller,
    sellers,
    linha: venda.telefone || venda.quantidade_linhas || '-',
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
    canceladaEm: venda.cancelada_em || null,
    motivoCancelamento: venda.motivo_cancelamento || null,
    canceladaPorId: venda.cancelada_por_id || null,
    historico: mapHistoricoVenda(venda, stage, updated, created, sellerName, stageLabels),
  };
}

function SaleModal({ sale, stages, stageLabels, onClose, onUpdateSale, onOpenFullSale, openingFullSale, podeCancelar, podeReverterCancelamento, onCancelSale, onReverterCancelamento }) {
  const [tab, setTab] = useState('info');
  const [novaFase, setNovaFase] = useState(sale.stage);
  const [novaPrioridade, setNovaPrioridade] = useState(sale.priority || 'media');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [historicoEventos, setHistoricoEventos] = useState(sale.historico);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const cancelada = Boolean(sale.canceladaEm);

  useEffect(() => {
    let cancelado = false;
    setHistoricoCarregando(true);

    buscarVendaPorId(sale.id)
      .then(venda => {
        if (cancelado) return;
        const sellerName = (venda.vendedoras || []).map(v => v?.nome).filter(Boolean).join(', ')
          || venda.vendedora?.nome
          || 'Sem vendedor';
        const stage = venda.status_funil || sale.stage;
        const created = venda.criado_em || venda.created_at || venda.data_venda;
        const updated = venda.ultima_atividade_em || venda.updated_at || venda.created_at;
        setHistoricoEventos(mapHistoricoVenda(venda, stage, updated, created, sellerName, stageLabels));
      })
      .catch(() => { /* mantém fallback */ })
      .finally(() => {
        if (!cancelado) setHistoricoCarregando(false);
      });

    return () => { cancelado = true; };
  }, [sale.id, stageLabels]);

  const saleComHistorico = { ...sale, historico: historicoEventos };

  const alterou = novaFase !== sale.stage
    || novaPrioridade !== (sale.priority || 'media')
    || observacao.trim() !== '';

  async function submitStatus(status, statusObservacao = observacao.trim(), motivoRetorno = '', options = {}) {
    setSaving(true);
    setError('');

    try {
      await onUpdateSale(sale.id, status, novaPrioridade, statusObservacao, motivoRetorno);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao atualizar status.');
      setSaving(false);
      if (options.rethrow) {
        throw err;
      }
    }
  }

  function handleAtualizar() {
    submitStatus(novaFase);
  }

  function handleConfirmRetorno({ motivo, observacao: observacaoRetorno }) {
    return submitStatus('retorno', observacaoRetorno, motivo, { rethrow: true });
  }

  async function handleConfirmCancelamento({ motivo }) {
    setSaving(true);
    setError('');

    try {
      await onCancelSale(sale.id, motivo);
      setCancelModalOpen(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao cancelar venda.');
      setSaving(false);
      throw err;
    }
  }

  async function handleConfirmReverter({ observacao }) {
    setSaving(true);
    setError('');

    try {
      await onReverterCancelamento(sale.id, observacao);
      setRevertModalOpen(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao reverter cancelamento.');
      setSaving(false);
      throw err;
    }
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
      {cancelModalOpen && (
        <CancelReasonModal
          sale={sale}
          saving={saving}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleConfirmCancelamento}
        />
      )}
      {revertModalOpen && (
        <RevertCancelamentoModal
          sale={sale}
          saving={saving}
          onClose={() => setRevertModalOpen(false)}
          onConfirm={handleConfirmReverter}
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
                <div className="label">{sale.sellers?.length > 1 ? 'VENDEDORES' : 'VENDEDOR'}</div>
                <div className="value funil-sellers-list">
                  {(sale.sellers || [sale.seller]).map(seller => (
                    <span key={seller.id || seller.name} className="funil-seller-item">
                      <SellerAvatar seller={seller} className="seller-detail-avatar" />
                      <span>{seller.name}</span>
                    </span>
                  ))}
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
                <div className="label">TELEFONE CELULAR</div>
                <div className="value mono">{sale.linha}</div>
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
            <>
              <SaleDeliveryTracker
                sale={saleComHistorico}
                stages={stages}
                stageLabels={stageLabels}
              />
              {historicoCarregando && historicoEventos === sale.historico ? (
                <div className="sale-event-list sale-event-list--empty">Carregando eventos…</div>
              ) : (
                <SaleEventList sale={saleComHistorico} />
              )}
            </>
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

              {cancelada && (
                <div className="alert-error" style={{ marginTop: 16 }}>
                  <strong>Venda cancelada.</strong> Motivo: {sale.motivoCancelamento || '(não informado)'}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!cancelada && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: 'var(--danger)', borderColor: '#fecaca' }}
                      onClick={() => setReturnModalOpen(true)}
                      disabled={saving}
                    >
                      <I.AlertTriangle size={13} /> Marcar como retorno
                    </button>
                  )}
                  {!cancelada && podeCancelar && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: '#fff', background: '#dc2626', borderColor: '#dc2626' }}
                      onClick={() => setCancelModalOpen(true)}
                      disabled={saving}
                    >
                      <I.AlertTriangle size={13} /> Cancelar venda
                    </button>
                  )}
                  {cancelada && podeReverterCancelamento && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setRevertModalOpen(true)}
                      disabled={saving}
                    >
                      Reverter cancelamento
                    </button>
                  )}
                </div>
                {!cancelada && alterou && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleAtualizar} disabled={saving}>
                    {saving ? 'Salvando...' : 'Confirmar mudança'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {onOpenFullSale && (
            <button type="button" className="btn btn-primary" onClick={onOpenFullSale} disabled={saving || openingFullSale}>
              <I.External size={13} /> {openingFullSale ? 'Abrindo...' : 'Abrir venda completa'}
            </button>
          )}
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
    const observacaoNormalizada = observacao.trim();
    const motivoFinal = motivo || observacaoNormalizada;

    if (!motivoFinal) {
      setError('Selecione um motivo ou descreva o retorno na observação.');
      return;
    }

    setError('');

    try {
      await onConfirm({ motivo: motivoFinal, observacao: observacaoNormalizada });
    } catch (err) {
      setError(err.message || 'Erro ao marcar retorno.');
    }
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
          <button type="submit" className="btn btn-primary" disabled={saving || (!motivo && !observacao.trim())}>
            {saving ? 'Salvando...' : 'Confirmar retorno'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RevertCancelamentoModal({ sale, saving, onClose, onConfirm }) {
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      await onConfirm({ observacao: observacao.trim() });
    } catch (err) {
      setError(err.message || 'Erro ao reverter cancelamento.');
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={event => !saving && event.target === event.currentTarget && onClose()}
      style={{ zIndex: 60 }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Reverter cancelamento</div>
              <div className="modal-sub">{sale.client} · #{sale.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            A venda voltará ao estado normal na etapa atual. Você pode registrar uma observação explicando o motivo da reversão (opcional).
          </div>
          {sale.motivoCancelamento && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              <strong>Motivo do cancelamento original:</strong> {sale.motivoCancelamento}
            </div>
          )}
          <div className="form-field">
            <label>Observação (opcional)</label>
            <textarea
              className="obs-textarea"
              placeholder="Ex: cliente confirmou que quer prosseguir com a venda."
              value={observacao}
              onChange={event => setObservacao(event.target.value)}
              disabled={saving}
              rows={4}
              autoFocus
            />
          </div>

          {error && <div className="alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Voltar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Revertendo...' : 'Confirmar reversão'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CancelReasonModal({ sale, saving, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const motivoLimpo = motivo.trim();

    if (!motivoLimpo) {
      setError('Informe o motivo do cancelamento.');
      return;
    }

    setError('');

    try {
      await onConfirm({ motivo: motivoLimpo });
    } catch (err) {
      setError(err.message || 'Erro ao cancelar venda.');
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={event => !saving && event.target === event.currentTarget && onClose()}
      style={{ zIndex: 60 }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Cancelar venda</div>
              <div className="modal-sub">{sale.client} · #{sale.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={saving}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            A venda permanecerá no funil, marcada como cancelada. Informe o motivo:
          </div>
          <div className="form-field">
            <label>Motivo do cancelamento</label>
            <textarea
              className="obs-textarea"
              placeholder="Ex: cliente desistiu, problema cadastral, etc."
              value={motivo}
              onChange={event => setMotivo(event.target.value)}
              disabled={saving}
              rows={4}
              autoFocus
            />
          </div>

          {error && <div className="alert-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Voltar</button>
          <button
            type="submit"
            className="btn"
            style={{ color: '#fff', background: '#dc2626', borderColor: '#dc2626' }}
            disabled={saving || !motivo.trim()}
          >
            {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
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
              Esta etapa não possui vendas e será excluída definitivamente.
            </div>
          ) : (
            <div className="alert-error">
              Existem {vendasCount} venda{vendasCount === 1 ? '' : 's'} nessa etapa. Por isso, ela será apenas desativada, continuará aparecendo no funil e deixará de ser um destino válido para vendas.
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

function SaleCard({ sale, onClick, onEmail, gerandoEmailId, onXlsxClaro, baixandoXlsxId, onWhatsapp }) {
  const priorityColor = PRIORITIES[sale.priority || 'media']?.color || '#3b82f6';
  const cancelada = Boolean(sale.canceladaEm);
  return (
    <div
      className={`sale-card${cancelada ? ' sale-card-cancelada' : ''}`}
      onClick={onClick}
      title={cancelada && sale.motivoCancelamento ? `Cancelada: ${sale.motivoCancelamento}` : undefined}
    >
      {cancelada && (
        <span className="sale-card-cancelada-tag">Cancelada</span>
      )}
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
        <div className="vendas-contact-actions sale-card-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, width: 'auto' }}>
          <button
            type="button"
            className="btn btn-icon btn-ghost vendas-whatsapp-btn"
            title="Gerar mensagem para WhatsApp"
            onClick={(e) => {
              e.stopPropagation();
              onWhatsapp(sale.raw);
            }}
            style={{ padding: 4, height: 24, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <I.Whatsapp size={12} />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost vendas-email-btn"
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
              <I.Mail size={12} />
            )}
          </button>
          {/claro/i.test(sale.raw?.operadora?.nome) && (
            <button
              type="button"
              className="btn btn-icon btn-ghost vendas-xlsx-btn"
              title="Baixar planilha Claro"
              disabled={baixandoXlsxId === sale.id}
              onClick={(e) => {
                e.stopPropagation();
                onXlsxClaro(sale.raw);
              }}
              style={{ padding: 4, height: 24, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <I.TableSheet size={12} />
            </button>
          )}
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

const DADOS_MODAL_VENDA_INICIAIS = {
  loaded: false,
  clientes: [],
  vendas: [],
  vendedoras: [],
  operadoras: [],
  tiposVenda: [],
  servicos: [],
  etapasFunil: []
};

function FunilPage() {
  const usuario = getUsuarioLocal();
  const podeGerenciarEtapas = temPermissao(usuario, 'crud_funil_etapas');
  const podeAbrirVendaCompleta = temPermissao(usuario, [
    'vendas',
    'vendas_ver_proprias',
    'vendas_ver_todas',
    'vendas_criar',
    'vendas_editar',
    'vendas_excluir'
  ]);
  const podeEditarVenda = temPermissao(usuario, ['vendas_editar', 'pos_venda']);
  const podeCancelarVenda = temPermissao(usuario, 'vendas_cancelar');
  const podeReverterCancelamentoVenda = temPermissao(usuario, 'vendas_reverter_cancelamento');
  const podeVerDocumentosVenda = temPermissao(usuario, 'vendas_documentos');
  const podeAdicionarDocumentosVenda = temPermissao(usuario, 'adicionar_documentos');
  const podeListarClientes = temPermissao(usuario, ['clientes_ver_proprios', 'clientes_ver_todos']);
  const [sales, setSales] = useState([]);
  const [stages, setStages] = useState(FALLBACK_STAGES);
  const [adminStages, setAdminStages] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [busca, setBusca] = useState('');
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
  const [whatsappMensagem, setWhatsappMensagem] = useState(null);
  const [copiandoWhatsapp, setCopiandoWhatsapp] = useState(false);
  const [agora, setAgora] = useState(Date.now);
  const [baixandoXlsxId, setBaixandoXlsxId] = useState(null);
  const [vendaCompleta, setVendaCompleta] = useState(null);
  const [dadosModalVenda, setDadosModalVenda] = useState(DADOS_MODAL_VENDA_INICIAIS);
  const [abrindoVendaCompletaId, setAbrindoVendaCompletaId] = useState(null);
  const [modalVendaModoEdicao, setModalVendaModoEdicao] = useState(false);
  const [clienteRapidoAberto, setClienteRapidoAberto] = useState(false);
  const [clienteRapidoInicial, setClienteRapidoInicial] = useState(null);
  const resolverClienteRapidoRef = useRef(null);

  const vendasPorCliente = useMemo(() => contarVendasPorCliente(dadosModalVenda.vendas), [dadosModalVenda.vendas]);
  const vendasEmAndamentoPorCliente = useMemo(() => {
    const codigosFinais = new Set(dadosModalVenda.etapasFunil.filter(etapa => etapa.etapa_final).map(etapa => etapa.codigo));
    const ativas = dadosModalVenda.vendas.filter(venda => !codigosFinais.has(venda.status_funil));
    return contarVendasPorCliente(ativas);
  }, [dadosModalVenda.vendas, dadosModalVenda.etapasFunil]);

  async function carregarDadosModalVenda({ force = false } = {}) {
    if (dadosModalVenda.loaded && !force) {
      return dadosModalVenda;
    }

    const [
      vendasData,
      clientesData,
      vendedorasData,
      operadorasData,
      tiposVendaData,
      servicosData,
      etapasFunilData
    ] = await Promise.all([
      listarVendas(),
      podeListarClientes ? listarClientes() : Promise.resolve([]),
      listarVendedoras(),
      listarOperadoras(),
      listarTiposVenda(),
      listarServicos(),
      listarEtapasFunil()
    ]);

    const dados = {
      loaded: true,
      clientes: clientesData || [],
      vendas: vendasData || [],
      vendedoras: vendedorasData || [],
      operadoras: operadorasData || [],
      tiposVenda: tiposVendaData || [],
      servicos: servicosData || [],
      etapasFunil: etapasFunilData || []
    };

    setDadosModalVenda(dados);
    return dados;
  }

  async function abrirVendaCompleta(sale) {
    if (!podeAbrirVendaCompleta || !sale?.id) return;

    setAbrindoVendaCompletaId(sale.id);
    setStageFeedback({ type: '', message: '' });

    try {
      const [venda] = await Promise.all([
        buscarVendaPorId(sale.id),
        carregarDadosModalVenda()
      ]);
      setVendaCompleta(venda);
      setModalVendaModoEdicao(false);
      setSelectedSaleId(null);
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao abrir venda completa.' });
    } finally {
      setAbrindoVendaCompletaId(null);
    }
  }

  function fecharVendaCompleta() {
    setVendaCompleta(null);
    setModalVendaModoEdicao(false);
  }

  async function salvarVendaCompleta(dados) {
    if (!vendaCompleta?.id) return;

    await atualizarVenda(vendaCompleta.id, dados);
    fecharVendaCompleta();
    await carregarDadosModalVenda({ force: true });
    await carregarVendas();
    setStageFeedback({ type: 'success', message: 'Venda atualizada com sucesso.' });
  }

  async function enviarPosVendaCompleta(venda) {
    const resultado = await enviarVendaParaPosVenda(venda.id);
    fecharVendaCompleta();
    await carregarDadosModalVenda({ force: true });
    await carregarVendas();
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    setStageFeedback({
      type: 'success',
      message: resultado?.status === 'pendente'
        ? (resultado.message || 'Solicitação enviada para aprovação do ADM.')
        : 'Venda enviada para o pos-venda.'
    });
  }

  function abrirClienteRapido(clienteInicial = null) {
    return new Promise(resolve => {
      resolverClienteRapidoRef.current = resolve;
      setClienteRapidoInicial(clienteInicial);
      setClienteRapidoAberto(true);
    });
  }

  function fecharClienteRapido(cliente = null) {
    setClienteRapidoAberto(false);
    setClienteRapidoInicial(null);
    resolverClienteRapidoRef.current?.(cliente);
    resolverClienteRapidoRef.current = null;
  }

  async function salvarClienteRapido(clienteCriado) {
    const clientesAtualizados = podeListarClientes ? await listarClientes() : [];
    setDadosModalVenda(prev => ({ ...prev, clientes: clientesAtualizados }));
    fecharClienteRapido(clienteCriado);
    return clienteCriado;
  }

  async function handleBaixarXlsxClaro(venda) {
    if (!venda?.id) return;
    setBaixandoXlsxId(venda.id);
    try {
      const nome = venda.razao_social || venda.cliente?.razao_social || venda.cliente?.nome || venda.id;
      await baixarXlsxClaro(venda.id, nome);
    } catch (err) {
      setStageFeedback({ type: 'error', message: err.message || 'Erro ao gerar planilha Claro.' });
    } finally {
      setBaixandoXlsxId(null);
    }
  }

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

  function abrirMensagemWhatsapp(venda) {
    if (!venda?.id) return;
    const documentosFaltantes = obterDocumentosFaltantesPadrao(venda);
    setWhatsappMensagem({
      venda,
      documentosFaltantes,
      texto: montarChecklistWhatsappVenda(venda, documentosFaltantes)
    });
  }

  function atualizarDocumentosWhatsapp(documentosFaltantes) {
    setWhatsappMensagem(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        documentosFaltantes,
        texto: montarChecklistWhatsappVenda(prev.venda, documentosFaltantes)
      };
    });
  }

  async function copiarMensagemWhatsapp() {
    if (!whatsappMensagem?.texto) return;

    setCopiandoWhatsapp(true);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(whatsappMensagem.texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = whatsappMensagem.texto;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setStageFeedback({ type: 'success', message: 'Mensagem do WhatsApp copiada.' });
      setWhatsappMensagem(null);
    } catch {
      setStageFeedback({ type: 'error', message: 'Não foi possível copiar a mensagem automaticamente.' });
    } finally {
      setCopiandoWhatsapp(false);
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
        listarVendas({ enviadas_pos_venda: '1', ocultar_concluidas_antigas: '1' }),
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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarVendas();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
          ? 'Etapa desativada porque possui vendas vinculadas. Ela continuará visível no funil.'
          : 'Etapa excluída com sucesso.',
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

      setSelectedSaleId(null);
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

  async function handleCancelarVenda(saleId, motivo) {
    const vendaAtualizada = await cancelarVenda(saleId, motivo);
    setSales(prev => prev.map(sale => {
      if (sale.id !== saleId) return sale;
      return {
        ...sale,
        ...mapVendaToSale(vendaAtualizada, stageLabels)
      };
    }));
  }

  async function handleReverterCancelamentoVenda(saleId, observacao) {
    const vendaAtualizada = await reverterCancelamentoVenda(saleId, observacao);
    setSales(prev => prev.map(sale => {
      if (sale.id !== saleId) return sale;
      return {
        ...sale,
        ...mapVendaToSale(vendaAtualizada, stageLabels)
      };
    }));
  }

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
  const { filtradas, total } = useMemo(() => {
    let etapasFinaisIds = new Set(stagesVisiveis.filter(st => st.etapaFinal).map(st => st.id));
    if (etapasFinaisIds.size === 0) {
      const validas = stagesVisiveis.filter(st => st.id !== 'retorno');
      if (validas.length > 0) {
        const maxOrdem = Math.max(...validas.map(st => st.ordem ?? 0));
        validas.filter(st => (st.ordem ?? 0) === maxOrdem).forEach(st => etapasFinaisIds.add(st.id));
      }
    }
    const filtered = sales.filter(s => {
      if (s.stage === 'retorno') return false;
      if (filter === 'canceladas') {
        if (!s.canceladaEm) return false;
      } else if (filter !== 'todas' && s.operator !== filter) {
        return false;
      }
      if (!vendaCorrespondeBusca(s, busca)) return false;
      return true;
    });
    return { filtradas: filtered, total: filtered.reduce((sum, s) => sum + s.value, 0) };
  }, [sales, stagesVisiveis, filter, busca, agora]);
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
          onOpenFullSale={podeAbrirVendaCompleta ? () => abrirVendaCompleta(selectedSale) : null}
          openingFullSale={abrindoVendaCompletaId === selectedSale.id}
          podeCancelar={podeCancelarVenda}
          podeReverterCancelamento={podeReverterCancelamentoVenda}
          onCancelSale={handleCancelarVenda}
          onReverterCancelamento={handleReverterCancelamentoVenda}
        />
      )}
      {vendaCompleta && (
        <VendaModal
          venda={vendaCompleta}
          clientes={dadosModalVenda.clientes}
          vendas={dadosModalVenda.vendas}
          vendedoras={dadosModalVenda.vendedoras}
          operadoras={dadosModalVenda.operadoras}
          tiposVenda={dadosModalVenda.tiposVenda}
          servicos={dadosModalVenda.servicos}
          vendasPorCliente={vendasPorCliente}
          vendasEmAndamentoPorCliente={vendasEmAndamentoPorCliente}
          podeEditarVenda={podeEditarVenda}
          podeVerDocumentosVenda={podeVerDocumentosVenda}
          podeAdicionarDocumentosVenda={podeAdicionarDocumentosVenda}
          usuarioLogado={usuario}
          modoEdicao={modalVendaModoEdicao}
          onStartEdit={() => setModalVendaModoEdicao(true)}
          onClose={fecharVendaCompleta}
          onSave={salvarVendaCompleta}
          onSendToPosVenda={enviarPosVendaCompleta}
          onCreateClient={abrirClienteRapido}
        />
      )}
      {clienteRapidoAberto && (
        <ClienteModal
          cliente={clienteRapidoInicial}
          operadoras={dadosModalVenda.operadoras}
          onClose={() => fecharClienteRapido(null)}
          onSave={salvarClienteRapido}
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

      <div className="page funil-page">
        <div className="filters funil-filters">
          <div className="search-box funnel-search-box">
            <I.Search size={14} />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar venda, cliente, CNPJ, telefone, plano..."
            />
            {busca && (
              <button
                type="button"
                className="btn btn-icon btn-ghost"
                onClick={() => setBusca('')}
                title="Limpar busca"
              >
                <I.Close size={12} />
              </button>
            )}
          </div>
          <div className="funil-chips-row">
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 4, flexShrink: 0 }}>Operadora:</span>
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
            <button
              type="button"
              className={`filter-chip ${filter === 'canceladas' ? 'active' : ''}`}
              onClick={() => setFilter('canceladas')}
              title="Mostrar somente vendas canceladas"
              style={filter === 'canceladas' ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : { color: '#dc2626', borderColor: '#fecaca' }}
            >
              Canceladas
            </button>
            <div className="funil-stats" style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5, flexShrink: 0 }}>
              <span className="muted">{filtradas.length} vendas</span>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span>
                <span className="muted">Total: </span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatBRL(total)}</strong>
              </span>
            </div>
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
                        onXlsxClaro={handleBaixarXlsxClaro}
                        baixandoXlsxId={baixandoXlsxId}
                        onWhatsapp={abrirMensagemWhatsapp}
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

      <WhatsappMensagemModal
        dados={whatsappMensagem}
        copiando={copiandoWhatsapp}
        onClose={() => setWhatsappMensagem(null)}
        onChange={texto => setWhatsappMensagem(prev => prev ? { ...prev, texto } : prev)}
        onDocsChange={atualizarDocumentosWhatsapp}
        onCopy={copiarMensagemWhatsapp}
      />
    </LayoutPrivado>
  );
}

export default FunilPage;
