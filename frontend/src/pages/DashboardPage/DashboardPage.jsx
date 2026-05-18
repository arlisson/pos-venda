import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getCampanhas, getProgresso, getProgressoUsuarios, resgatarCampanha } from '../../services/campanha.service';
import { buscarVendaPorId, enviarVendaParaPosVenda, listarVendedoras, obterResumoVendas } from '../../services/venda.service';
import { buscarClientePorId } from '../../services/cliente.service';
import { listarEtapasFunil, listarOperadoras, listarServicos, listarTiposVenda } from '../../services/config.service';
import { listarNotificacoes, marcarNotificacaoLida } from '../../services/notificacao.service';
import { obterContextoNotificacoesDashboard } from '../../services/dashboard.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import ClienteModal from '../Clientes/ClienteModal';
import VendaModal from '../VendasPage/VendaModal';
import * as I from '../../components/Icons';
import { formatUtcDateTime, getUtcDateTimeTimestamp, parseUtcDateTime } from '../../utils/datetime';
import './DashboardPage.css';

const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isMoneyGoal = (campanha) => (
  /R\$/i.test(campanha.desc || '') ||
  ['valor', 'receita', 'faturamento'].some(key => String(campanha.tipo || '').toLowerCase().includes(key))
);

const formatGoalValue = (campanha, value) => (
  isMoneyGoal(campanha) ? formatBRL(value) : value
);

const PERIOD_LABELS = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
};

const CATEGORY_LABELS = {
  registro_cliente: 'Registro de cliente',
  chip_novo: 'Chip novo',
  portabilidade: 'Portabilidade',
  internet: 'Internet',
};

const TIPOS_RETORNO_NOTA = ['nota_retorno_pre', 'nota_retorno_due'];
const TIPOS_PROBLEMA_VENDA = ['venda_problema_aberto', 'venda_problema_resolvido', 'venda_problema_correcao'];
const TIPOS_APROVACAO_VENDA = ['venda_aprovacao_pendente'];
const TIPO_VENDA_PARADA = 'venda_parada_funil';
const RETORNO_PRE_AVISO_MINUTOS = 15;
const NOTIFICATION_DRAWER_KEYS = ['retornos', 'fidelidade', 'ligacoes', 'vendas-paradas', 'problemas'];

function getCampanhaKey(campanha) {
  return campanha.tipo || `${campanha.periodo || 'diaria'}_${campanha.categoria || 'registro_cliente'}`;
}

function getCampanhaScope(campanha) {
  const periodo = PERIOD_LABELS[campanha.periodo] || 'Diária';
  const categoria = CATEGORY_LABELS[campanha.categoria] || campanha.categoria || 'Campanha';
  const operadora = campanha.operadora_nome ? ` - ${campanha.operadora_nome}` : '';
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

function ContatosMarcadosModal({ open, notificacoes, onClose, onOpenNotification }) {
  if (!open) return null;

  async function handleOpenNotification(notificacao) {
    onClose();
    await onOpenNotification(notificacao);
  }

  return (
    <div className="modal-overlay contatos-marcados-overlay" onClick={onClose}>
      <div
        className="modal contatos-marcados-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contatos-marcados-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client" id="contatos-marcados-title">Contatos marcados</div>
              <div className="modal-sub">{notificacoes.length} liga&ccedil;&atilde;o{notificacoes.length === 1 ? '' : 'es'} com retorno ativo</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} title="Fechar">
              <I.Close size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body contatos-marcados-body">
          {notificacoes.length === 0 ? (
            <div className="contatos-marcados-empty">Nenhum contato marcado.</div>
          ) : (
            <div className="contatos-marcados-list">
              {notificacoes.map(notificacao => (
                <button
                  key={notificacao.destinatario_id || notificacao.id}
                  type="button"
                  className={`contatos-marcados-item ${notificacao.lida === false ? 'is-unread' : ''}`}
                  onClick={() => handleOpenNotification(notificacao)}
                >
                  <span className="contatos-marcados-item__icon">
                    <I.Whatsapp size={15} />
                  </span>
                  <span className="contatos-marcados-item__content">
                    <strong>{getNotificacaoTitulo(notificacao)}</strong>
                    <span>{getNotificacaoDescricao(notificacao)}</span>
                    <em>{getRetornoPrazo(notificacao)}</em>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
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
    return Number(notificacao.dados?.dias_restantes ?? 1) < 0
      ? '/clientes?fidelidade=vencida'
      : '/clientes?fidelidade=alerta';
  }

  if (notificacao.entidade === 'clientes') {
    const clienteId = notificacao.entidade_id || notificacao.dados?.entidade_id;
    return clienteId ? `/clientes?cliente_id=${clienteId}&highlight=${clienteId}` : '/clientes';
  }

  if (notificacao.entidade === 'vendas') {
    const vendaId = notificacao.entidade_id || notificacao.dados?.venda_id;
    if (!vendaId) return '/vendas';

    if (TIPOS_APROVACAO_VENDA.includes(notificacao.tipo)) {
      const solicitacaoId = notificacao.dados?.solicitacao_id;
      return solicitacaoId ? `/vendas/aprovacoes?solicitacao_id=${solicitacaoId}` : '/vendas/aprovacoes';
    }

    if (TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)) {
      const problemaId = notificacao.dados?.problema_id;
      return `/vendas?venda_id=${vendaId}&aba=problema${problemaId ? `&problema_id=${problemaId}` : ''}`;
    }

    if (notificacao.tipo === TIPO_VENDA_PARADA) {
      return `/vendas?venda_id=${vendaId}`;
    }

    if (TIPOS_RETORNO_NOTA.includes(notificacao.tipo)) {
      return `/vendas?venda_id=${vendaId}&aba=notas`;
    }

    return `/vendas?venda_id=${vendaId}`;
  }

  return null;
}

function getRetornoTimestamp(notificacao) {
  const valor = notificacao?.dados?.retorno_agendado_para || notificacao?.updated_at;
  return getUtcDateTimeTimestamp(valor, Number.MAX_SAFE_INTEGER);
}

function formatarRetornoResumo(notificacao) {
  const valor = notificacao?.dados?.retorno_agendado_para;
  if (!valor) return 'sem data definida';

  return formatUtcDateTime(valor, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }, 'sem data definida');
}

function getRetornoMinutosParaVencer(notificacao) {
  const data = parseUtcDateTime(notificacao?.dados?.retorno_agendado_para);
  if (!data) return null;

  return Math.ceil((data.getTime() - Date.now()) / 60000);
}

function retornoDeveAparecerNoCard(notificacao) {
  if (!TIPOS_RETORNO_NOTA.includes(notificacao.tipo)) return false;
  if (notificacao.tipo === 'nota_retorno_due') return true;

  const minutos = getRetornoMinutosParaVencer(notificacao);
  return minutos !== null && minutos > 0 && minutos <= RETORNO_PRE_AVISO_MINUTOS;
}

function formatarPrazoRelativo(valor) {
  if (!valor) return 'Pendente';

  const data = parseUtcDateTime(valor);
  if (!data) return 'Pendente';

  const agora = new Date();
  const diffDias = Math.round((agora.setHours(0, 0, 0, 0) - data.setHours(0, 0, 0, 0)) / 86400000);

  if (diffDias <= 0) return 'Pendente hoje';
  return `Pendência há ${diffDias} dia${diffDias === 1 ? '' : 's'}`;
}

function getNotificacaoTitulo(notificacao) {
  return notificacao?.dados?.cliente_nome
    || notificacao?.dados?.venda_nome
    || notificacao?.dados?.titulo_nota
    || notificacao?.titulo
    || 'Sem titulo';
}

function getNotificacaoDescricao(notificacao) {
  if (!notificacao) return '';

  if (notificacao.tipo === 'cliente_fidelidade') {
    return notificacao.mensagem;
  }

  if (TIPOS_RETORNO_NOTA.includes(notificacao.tipo)) {
    return notificacao.mensagem
      .replace(/^Retorne a liga(?:ção|cao) de\s*/i, '')
      .replace(/^Retorno de\s*/i, '');
  }

  if (TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)) {
    return notificacao.dados?.mensagem || notificacao.mensagem;
  }

  return notificacao.mensagem;
}

function montarTooltipNotificacao(titulo, descricao) {
  return [titulo, descricao]
    .map(valor => String(valor || '').trim())
    .filter(Boolean)
    .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
    .join('\n');
}

function getNotificacaoTooltip(notificacao) {
  if (!notificacao) return '';

  const titulo = getNotificacaoTitulo(notificacao);
  const descricao = TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)
    ? notificacao.dados?.mensagem || notificacao.mensagem
    : getNotificacaoDescricao(notificacao);

  return montarTooltipNotificacao(titulo, descricao);
}

function getFidelidadePrazo(notificacao) {
  const dias = Number(notificacao?.dados?.dias_restantes);
  if (!Number.isFinite(dias)) return 'Sem data';
  if (dias < 0) return `Vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoje';
  return `Vence em ${dias} dias`;
}

function getRetornoPrazo(notificacao) {
  if (notificacao?.tipo === 'nota_retorno_due') return 'Ligação vencida';

  const minutos = getRetornoMinutosParaVencer(notificacao);

  if (minutos !== null && minutos <= 0) return 'Ligação vencida';
  if (minutos !== null && minutos <= RETORNO_PRE_AVISO_MINUTOS) {
    return minutos === 1 ? 'Falta 1 minuto para vencer' : `Faltam ${minutos} minutos para vencer`;
  }

  return formatarRetornoResumo(notificacao);
}

function getVendaParadaPrazo(notificacao) {
  const horas = Number(notificacao?.dados?.horas);

  if (Number.isFinite(horas) && horas >= 0) {
    const dias = Math.floor(horas / 24);
    return `Parada há ${dias} dia${dias === 1 ? '' : 's'}`;
  }

  return formatarPrazoRelativo(notificacao?.dados?.data_entrada || notificacao?.updated_at);
}

function getVendaRetornoTimestamp(venda) {
  const valor = venda?.retornou_em || venda?.updated_at || venda?.ultima_atividade_em;
  return getUtcDateTimeTimestamp(valor, 0);
}

function formatarDataRetornoVenda(venda) {
  const timestamp = getVendaRetornoTimestamp(venda);
  if (!timestamp) return 'Retorno registrado';

  return formatUtcDateTime(timestamp, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getVendaRetornoTitulo(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

function getVendaRetornoDescricao(venda) {
  return venda?.motivo_retorno || 'Sem motivo informado';
}

function montarMapaReferencias(referencias = [], campo = 'total') {
  return referencias.reduce((mapa, item) => {
    if (item?.chave) mapa.set(item.chave, Number(item[campo] || 0));
    return mapa;
  }, new Map());
}

function DashboardPage() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();
  const [campanhas, setCampanhas] = useState([]);
  const [progresso, setProgresso] = useState({});
  const [stats, setStats] = useState(EMPTY_STATS);
  const [openedGifts, setOpenedGifts] = useState(new Set());
  const [claimingId, setClaimingId] = useState(null);
  const [selectedReward, setSelectedReward] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [progressoUsuarios, setProgressoUsuarios] = useState([]);
  const [usuarioCampanhaFiltro, setUsuarioCampanhaFiltro] = useState('');
  const [usuarioCampanhaBusca, setUsuarioCampanhaBusca] = useState('');
  const [notificacoes, setNotificacoes] = useState([]);
  const [contatosMarcadosOpen, setContatosMarcadosOpen] = useState(false);
  const [openNotificationDrawers, setOpenNotificationDrawers] = useState(() => (
    typeof window !== 'undefined' && window.innerWidth > 760
      ? new Set(NOTIFICATION_DRAWER_KEYS)
      : new Set()
  ));
  const [openTeamGoalDrawers, setOpenTeamGoalDrawers] = useState(new Set());
  const [teamGoalMobileLayout, setTeamGoalMobileLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 760 : false
  ));
  const [vendasRetorno, setVendasRetorno] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [referenciasClientes, setReferenciasClientes] = useState([]);
  const [vendasAtivasIdsLista, setVendasAtivasIdsLista] = useState([]);
  const [vendasCarregadas, setVendasCarregadas] = useState(false);
  const [vendedoras, setVendedoras] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [tiposVenda, setTiposVenda] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [etapasFunil, setEtapasFunil] = useState([]);
  const [clienteModal, setClienteModal] = useState(null);
  const [clienteModalAba, setClienteModalAba] = useState('cliente');
  const [vendaModal, setVendaModal] = useState(null);
  const [vendaModalAba, setVendaModalAba] = useState('venda');
  const [vendaModalProblemaId, setVendaModalProblemaId] = useState(null);
  const podeVerResumoVendas = temPermissao(usuario, 'dashboard_resumo_vendas');
  const podeVerRetornos = temPermissao(usuario, ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas']);
  const podeEditarVenda = temPermissao(usuario, ['vendas_editar', 'pos_venda']);
  const podeVerDocumentosVenda = temPermissao(usuario, 'vendas_documentos');
  const podeAdicionarDocumentosVenda = temPermissao(usuario, 'adicionar_documentos');
  const podeVerCampanhas = temPermissao(usuario, 'campanhas_visualizar');
  const podeVerCampanhasUsuarios = temPermissao(usuario, 'campanhas_ver_usuarios');
  const podeVerVendasParadas = temPermissao(usuario, 'notificacoes_vendas_paradas');
  const podeVerNotificacoes = Boolean(usuario) || temPermissao(usuario, 'notificacoes_visualizar');

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), feedback.type === 'success' ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const handleChange = event => setTeamGoalMobileLayout(event.matches);

    setTeamGoalMobileLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (podeVerCampanhas) {
      getCampanhas().then(setCampanhas).catch(console.error);
      getProgresso()
        .then(data => {
          setProgresso(data);
          setOpenedGifts(new Set((data.resgatadas || []).map(Number)));
        })
        .catch(console.error);
    } else {
      setCampanhas([]);
      setProgresso({});
      setOpenedGifts(new Set());
    }

    if (podeVerResumoVendas || podeVerRetornos) {
      obterResumoVendas().then(setStats).catch(console.error);
    }

  }, [podeVerCampanhas, podeVerResumoVendas, podeVerRetornos]);

  useEffect(() => {
    if (!podeVerNotificacoes) return undefined;

    Promise.all([
      obterContextoNotificacoesDashboard().catch(() => ({})),
      listarVendedoras().catch(() => []),
      listarOperadoras().catch(() => []),
      listarTiposVenda().catch(() => []),
      listarServicos().catch(() => []),
      listarEtapasFunil().catch(() => [])
    ]).then(([
      contextoData,
      vendedorasData,
      operadorasData,
      tiposVendaData,
      servicosData,
      etapasData
    ]) => {
      setClientes(Array.isArray(contextoData.clientes) ? contextoData.clientes : []);
      setReferenciasClientes(Array.isArray(contextoData.referencias_clientes) ? contextoData.referencias_clientes : []);
      setVendasAtivasIdsLista(Array.isArray(contextoData.vendas_ativas_ids) ? contextoData.vendas_ativas_ids : []);
      setVendasRetorno(Array.isArray(contextoData.vendas_retorno) ? contextoData.vendas_retorno : []);
      setVendas([]);
      setVendasCarregadas(Array.isArray(contextoData.vendas_ativas_ids) && contextoData.vendas_ativas_ids.length > 0);
      setVendedoras(Array.isArray(vendedorasData) ? vendedorasData : []);
      setOperadoras(Array.isArray(operadorasData) ? operadorasData : []);
      setTiposVenda(Array.isArray(tiposVendaData) ? tiposVendaData : []);
      setServicos(Array.isArray(servicosData) ? servicosData : []);
      setEtapasFunil(Array.isArray(etapasData) ? etapasData : []);
    }).catch(console.error);
  }, [podeVerNotificacoes]);

  useEffect(() => {
    if (!podeVerCampanhasUsuarios) return undefined;

    getProgressoUsuarios()
      .then(data => setProgressoUsuarios(data.usuarios || []))
      .catch(console.error);
  }, [podeVerCampanhasUsuarios]);

  useEffect(() => {
    if (!podeVerNotificacoes) {
      setNotificacoes([]);
      return undefined;
    }

    let ativo = true;
    const carregarNotificacoesDashboard = () => {
      listarNotificacoes({ limit: 24 })
        .then(data => {
          if (ativo) setNotificacoes(data.notificacoes || []);
        })
        .catch(console.error);
    };

    carregarNotificacoesDashboard();
    const timer = setInterval(carregarNotificacoesDashboard, 60000);

    function handleRefreshNotifications() {
      carregarNotificacoesDashboard();
    }

    window.addEventListener('pos-venda:notificacoes-atualizar', handleRefreshNotifications);

    return () => {
      ativo = false;
      clearInterval(timer);
      window.removeEventListener('pos-venda:notificacoes-atualizar', handleRefreshNotifications);
    };
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

  async function marcarNotificacaoComoLidaLocal(notificacao) {
    if (!notificacao?.id || notificacao.lida) return;

    await marcarNotificacaoLida(notificacao.id);
    setNotificacoes(prev => prev.map(item => (
      item.id === notificacao.id ? { ...item, lida: true } : item
    )));
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
  }

  async function abrirClienteNoDashboard(clienteId, aba = 'cliente') {
    if (!clienteId) return;

    const clienteLocal = clientes.find(item => String(item.id) === String(clienteId));
    const cliente = clienteLocal || await buscarClientePorId(clienteId);
    setClienteModal(cliente);
    setClienteModalAba(aba);
  }

  async function abrirVendaNoDashboard(vendaId, aba = 'venda', problemaId = null) {
    if (!vendaId) return;

    const vendaLocal = vendas.find(item => String(item.id) === String(vendaId))
      || vendasRetorno.find(item => String(item.id) === String(vendaId));
    const venda = vendaLocal || await buscarVendaPorId(vendaId);
    setVendaModal(venda);
    setVendaModalAba(aba);
    setVendaModalProblemaId(problemaId);
  }

  async function abrirNotificacaoNoDashboard(notificacao) {
    await marcarNotificacaoComoLidaLocal(notificacao);

    if (notificacao.tipo === 'cliente_fidelidade' || notificacao.entidade === 'clientes') {
      const aba = TIPOS_RETORNO_NOTA.includes(notificacao.tipo) ? 'notas' : 'cliente';
      await abrirClienteNoDashboard(notificacao.entidade_id || notificacao.dados?.entidade_id, aba);
      return;
    }

    if (notificacao.entidade === 'vendas') {
      const vendaId = notificacao.entidade_id || notificacao.dados?.venda_id || notificacao.dados?.entidade_id;
      const aba = TIPOS_RETORNO_NOTA.includes(notificacao.tipo)
        ? 'notas'
        : TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)
          ? 'problema'
          : 'venda';
      await abrirVendaNoDashboard(vendaId, aba, notificacao.dados?.problema_id || null);
    }
  }

  async function salvarClienteDashboard(clienteSalvo) {
    setClienteModal(null);
    setClientes(prev => {
      const existe = prev.some(item => String(item.id) === String(clienteSalvo.id));
      return existe
        ? prev.map(item => String(item.id) === String(clienteSalvo.id) ? clienteSalvo : item)
        : [clienteSalvo, ...prev];
    });
  }

  async function salvarVendaDashboard(vendaSalva) {
    setVendaModal(null);
    setVendaModalAba('venda');
    setVendaModalProblemaId(null);
    setVendas(prev => {
      const existe = prev.some(item => String(item.id) === String(vendaSalva.id));
      return existe
        ? prev.map(item => String(item.id) === String(vendaSalva.id) ? vendaSalva : item)
        : [vendaSalva, ...prev];
    });
    setVendasRetorno(prev => vendaSalva.status_funil === 'retorno'
      ? (prev.some(item => String(item.id) === String(vendaSalva.id))
        ? prev.map(item => String(item.id) === String(vendaSalva.id) ? vendaSalva : item)
        : [vendaSalva, ...prev])
      : prev.filter(item => String(item.id) !== String(vendaSalva.id)));
  }

  const buscaUsuarioCampanhaNormalizada = usuarioCampanhaBusca.trim().toLowerCase();
  const progressoUsuariosFiltrados = progressoUsuarios.filter(item => {
    if (usuarioCampanhaFiltro && String(item.id) !== String(usuarioCampanhaFiltro)) {
      return false;
    }

    if (!buscaUsuarioCampanhaNormalizada) {
      return true;
    }

    return [item.nome, item.email]
      .filter(Boolean)
      .some(valor => String(valor).toLowerCase().includes(buscaUsuarioCampanhaNormalizada));
  });

  const giftCampanhas = campanhas.filter(m => m.is_gift);
  const campanhasComProgresso = giftCampanhas.map(campanha => {
    const current = progresso.campanhas?.[campanha.id] ?? progresso[getCampanhaKey(campanha)] ?? 0;
    const target = Number(campanha.target) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { ...campanha, current, pct, achieved: pct >= 100 };
  });

  const doneCount = campanhasComProgresso.filter(m => m.achieved).length;
  const totalCount = campanhasComProgresso.length;
  const overallPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const vendasPorCliente = useMemo(() => montarMapaReferencias(referenciasClientes, 'total'), [referenciasClientes]);
  const vendasEmAndamentoPorCliente = useMemo(() => montarMapaReferencias(referenciasClientes, 'em_andamento_total'), [referenciasClientes]);

  const firstName = usuario?.nome?.split(' ')[0] || 'você';
  const notificacoesFidelidade = notificacoes
    .filter(notificacao => notificacao.tipo === 'cliente_fidelidade')
    .sort((a, b) => Number(a.dados?.dias_restantes ?? 999) - Number(b.dados?.dias_restantes ?? 999));
  const notificacoesRetorno = notificacoes
    .filter(retornoDeveAparecerNoCard)
    .sort((a, b) => getRetornoTimestamp(a) - getRetornoTimestamp(b));
  const retornosVenda = vendasRetorno
    .slice()
    .sort((a, b) => getVendaRetornoTimestamp(b) - getVendaRetornoTimestamp(a));
  const vendasAtivasIds = useMemo(
    () => new Set(vendasAtivasIdsLista.map(id => String(id))),
    [vendasAtivasIdsLista]
  );
  const notificacoesProblema = notificacoes
    .filter(notificacao => {
      if (!TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)) return false;
      if (!vendasCarregadas) return true;
      const vendaId = notificacao.entidade_id || notificacao.dados?.venda_id;
      if (!vendaId) return true;
      return vendasAtivasIds.has(String(vendaId));
    })
    .sort((a, b) => getUtcDateTimeTimestamp(b.updated_at) - getUtcDateTimeTimestamp(a.updated_at));
  const notificacoesVendasParadas = notificacoes
    .filter(notificacao => {
      if (!podeVerVendasParadas || notificacao.tipo !== TIPO_VENDA_PARADA) return false;
      if (!vendasCarregadas) return true;
      const vendaId = notificacao.entidade_id || notificacao.dados?.venda_id;
      if (!vendaId) return true;
      return vendasAtivasIds.has(String(vendaId));
    })
    .sort((a, b) => Number(b.dados?.horas || 0) - Number(a.dados?.horas || 0));
  const notificacaoCards = [
    {
      key: 'retornos',
      title: 'Retornos',
      subtitle: 'Chips devolvidos',
      count: retornosVenda.length,
      variant: 'danger',
      icon: <I.AlertTriangle size={15} />,
      items: retornosVenda,
      getTitle: getVendaRetornoTitulo,
      getDescription: getVendaRetornoDescricao,
      metric: formatarDataRetornoVenda,
      actionLabel: 'Ver todos os retornos',
      onAction: () => navigate('/retornos'),
      onItemClick: venda => abrirVendaNoDashboard(venda.id)
    },
    {
      key: 'fidelidade',
      title: 'Fim de fidelidade',
      subtitle: 'Próximos 30 dias',
      count: notificacoesFidelidade.length,
      variant: 'warn',
      icon: <I.History size={15} />,
      items: notificacoesFidelidade,
      getTitle: getNotificacaoTitulo,
      getDescription: getNotificacaoDescricao,
      getTooltip: getNotificacaoTooltip,
      metric: getFidelidadePrazo,
      actionLabel: 'Iniciar abordagem de renovação',
      onAction: () => navigate('/clientes?fidelidade=alerta'),
      onItemClick: abrirNotificacaoNoDashboard
    },
    {
      key: 'ligacoes',
      title: 'Ligações marcadas',
      subtitle: 'Retornos de contato',
      count: notificacoesRetorno.length,
      variant: 'contact',
      icon: <I.Whatsapp size={15} />,
      items: notificacoesRetorno,
      getTitle: getNotificacaoTitulo,
      getDescription: getNotificacaoDescricao,
      getTooltip: getNotificacaoTooltip,
      metric: getRetornoPrazo,
      actionLabel: 'Ver contatos marcados',
      onAction: () => setContatosMarcadosOpen(true),
      onItemClick: abrirNotificacaoNoDashboard
    },
    ...(podeVerVendasParadas ? [{
      key: 'vendas-paradas',
      title: 'Vendas paradas',
      subtitle: 'Mais de 5 dias',
      count: notificacoesVendasParadas.length,
      variant: 'stalled',
      icon: <I.History size={15} />,
      items: notificacoesVendasParadas,
      getTitle: getNotificacaoTitulo,
      getDescription: getNotificacaoDescricao,
      getTooltip: getNotificacaoTooltip,
      metric: getVendaParadaPrazo,
      actionLabel: 'Ver vendas paradas',
      onAction: () => {
        if (notificacoesVendasParadas[0]) {
          abrirNotificacaoNoDashboard(notificacoesVendasParadas[0]);
          return;
        }
        navigate('/funil');
      },
      onItemClick: abrirNotificacaoNoDashboard
    }] : []),
    {
      key: 'problemas',
      title: 'Vendas com problema',
      subtitle: 'Precisam de ação',
      count: notificacoesProblema.length,
      variant: 'info',
      icon: <I.AlertTriangle size={15} />,
      items: notificacoesProblema,
      getTitle: getNotificacaoTitulo,
      getDescription: getNotificacaoDescricao,
      getTooltip: getNotificacaoTooltip,
      metric: notificacao => formatarPrazoRelativo(notificacao.updated_at),
      actionLabel: 'Resolver pendências',
      onAction: () => {
        if (notificacoesProblema[0]) {
          abrirNotificacaoNoDashboard(notificacoesProblema[0]);
          return;
        }
        navigate('/vendas');
      },
      onItemClick: abrirNotificacaoNoDashboard
    }
  ];

  function toggleNotificationDrawer(key) {
    setOpenNotificationDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function isTeamGoalDrawerOpen(id) {
    return !teamGoalMobileLayout || openTeamGoalDrawers.has(String(id));
  }

  function toggleTeamGoalDrawer(id) {
    const key = String(id);
    setOpenTeamGoalDrawers(prev => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  const proximaFidelidade = notificacoesFidelidade[0];
  const proximoRetorno = notificacoesRetorno[0];
  const proximoProblema = notificacoesProblema[0];
  const retornosNaoLidos = notificacoesRetorno.some(notificacao => !notificacao.lida);
  const retornosVencidos = notificacoesRetorno.filter(notificacao => notificacao.tipo === 'nota_retorno_due').length;
  const problemasNaoLidos = notificacoesProblema.some(notificacao => !notificacao.lida);
  const fidelidadeTextoPrazo = proximaFidelidade?.dados?.dias_restantes < 0
    ? `vencida há ${Math.abs(proximaFidelidade.dados.dias_restantes)} dia${Math.abs(proximaFidelidade.dados.dias_restantes) === 1 ? '' : 's'}`
    : proximaFidelidade?.dados?.dias_restantes === 0
      ? 'vence hoje'
      : `vence em ${proximaFidelidade?.dados?.dias_restantes} dias`;

  const handleOpenGift = async (campanha) => {
    setClaimingId(campanha.id);
    setFeedback(null);

    try {
      const result = await resgatarCampanha(campanha.id);
      setOpenedGifts(prev => new Set([...prev, Number(campanha.id)]));
      setSelectedReward({
        ...campanha,
        reward: result.reward || campanha.reward
      });
      setFeedback({ type: 'success', text: 'Campanha resgatada com sucesso.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', text: error.message || 'Erro ao resgatar campanha.' });
    } finally {
      setClaimingId(null);
    }
  };

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <LayoutPrivado>
      {clienteModal && (
        <ClienteModal
          cliente={clienteModal}
          operadoras={operadoras}
          initialTab={clienteModalAba}
          onClose={() => {
            setClienteModal(null);
            setClienteModalAba('cliente');
          }}
          onSave={salvarClienteDashboard}
        />
      )}

      {vendaModal && (
        <VendaModal
          venda={vendaModal}
          clientes={clientes}
          vendas={[]}
          vendedoras={vendedoras}
          operadoras={operadoras}
          tiposVenda={tiposVenda}
          servicos={servicos}
          vendasPorCliente={vendasPorCliente}
          vendasEmAndamentoPorCliente={vendasEmAndamentoPorCliente}
          podeEditarVenda={podeEditarVenda}
          podeVerDocumentosVenda={podeVerDocumentosVenda}
          podeAdicionarDocumentosVenda={podeAdicionarDocumentosVenda}
          usuarioLogado={usuario}
          initialTab={vendaModalAba}
          initialProblemaId={vendaModalProblemaId}
          modoEdicao={podeEditarVenda}
          onStartEdit={() => {}}
          onClose={() => {
            setVendaModal(null);
            setVendaModalAba('venda');
            setVendaModalProblemaId(null);
          }}
          onSave={salvarVendaDashboard}
          onSendToPosVenda={async venda => {
            await enviarVendaParaPosVenda(venda.id);
            setVendaModal(null);
            window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
          }}
        />
      )}

      <div className="dashboard-container">
        <RewardModal gift={selectedReward} onClose={() => setSelectedReward(null)} />
        <ContatosMarcadosModal
          open={contatosMarcadosOpen}
          notificacoes={notificacoesRetorno}
          onClose={() => setContatosMarcadosOpen(false)}
          onOpenNotification={abrirNotificacaoNoDashboard}
        />
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

        {(notificacoesFidelidade.length > 0 || retornosVenda.length > 0 || notificacoesRetorno.length > 0 || notificacoesProblema.length > 0) && (
          <section className="home-notifications">
            <div className="home-notifications__header">
              <div>
                <h2>Notificações</h2>
                <p>Acompanhe os pontos que exigem atenção imediata.</p>
              </div>
            </div>

            <div className="home-notifications__list">
              {notificacaoCards.map(card => {
                const drawerOpen = openNotificationDrawers.has(card.key);
                const drawerId = `home-notification-card-${card.key}`;

                return (
                <article key={card.key} className={`home-notification-card home-notification-card--${card.variant} ${drawerOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="home-notification-card__top"
                    aria-expanded={drawerOpen}
                    aria-controls={drawerId}
                    onClick={() => toggleNotificationDrawer(card.key)}
                  >
                    <span className="home-notification-card__icon">{card.icon}</span>
                    <span className="home-notification-card__title">
                      <strong>{card.title}</strong>
                      <em>{card.subtitle}</em>
                    </span>
                    <span className="home-notification-card__count">{card.count}</span>
                    <span className="home-notification-card__chevron" aria-hidden="true">
                      <I.ChevronDown size={14} />
                    </span>
                  </button>

                  <div id={drawerId} className="home-notification-card__drawer">
                    <div className="home-notification-card__items is-scrollable">
                    {card.items.length === 0 ? (
                      <div className="home-notification-card__empty">Nenhuma notificação ativa.</div>
                    ) : card.items.map(notificacao => {
                      const itemTitle = card.getTitle(notificacao);
                      const itemDescription = card.getDescription(notificacao);
                      const itemTooltip = card.getTooltip
                        ? card.getTooltip(notificacao)
                        : montarTooltipNotificacao(itemTitle, itemDescription);

                      return (
                        <button
                          type="button"
                          key={notificacao.destinatario_id || notificacao.id}
                          className={`home-notification-card__item ${notificacao.lida === false ? 'is-unread' : ''}`}
                          onClick={() => card.onItemClick(notificacao)}
                          title={itemTooltip || undefined}
                          aria-label={itemTooltip || itemTitle}
                        >
                          <strong>{itemTitle}</strong>
                          <span>{itemDescription}</span>
                          <em>{card.metric(notificacao)}</em>
                        </button>
                      );
                    })}
                  </div>

                  <button type="button" className="home-notification-card__action" disabled={card.count === 0} onClick={card.onAction}>
                    {card.actionLabel} <I.ArrowRight size={13} />
                  </button>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        )}

        {false && (notificacoesFidelidade.length > 0 || notificacoesRetorno.length > 0 || notificacoesProblema.length > 0) && (
          <section className="home-notifications">
            <div className="home-notifications__header">
              <div>
                <h2>Notificações</h2>
                <p>Acompanhe os três pontos que exigem atenção imediata.</p>
              </div>
            </div>

            <div className="home-notifications__list">
              <button
                type="button"
                className={`home-notification home-notification--fixed home-notification--fidelity ${proximaFidelidade?.lida ? '' : 'is-unread'} ${proximaFidelidade?.nivel || 'warn'} ${notificacoesFidelidade.length === 0 ? 'is-empty' : ''}`}
                disabled={notificacoesFidelidade.length === 0}
                onClick={() => proximaFidelidade && handleReadNotification(proximaFidelidade)}
              >
                <span className="home-notification__icon">
                  <I.AlertTriangle size={16} />
                </span>
                <span className="home-notification__content">
                  <em>Fidelidade</em>
                  <strong>
                    {notificacoesFidelidade.length > 0
                      ? `${notificacoesFidelidade.length} cliente${notificacoesFidelidade.length === 1 ? '' : 's'} em alerta`
                      : 'Sem fidelidades em alerta'}
                  </strong>
                  <span>
                    {proximaFidelidade
                      ? `Mais urgente: ${proximaFidelidade.dados?.cliente_nome || 'cliente'} - ${fidelidadeTextoPrazo}.`
                      : 'Nenhum cliente perto do vencimento agora.'}
                  </span>
                </span>
                <span className="home-notification__days">
                  {proximaFidelidade?.dados?.dias_restantes === 0
                    ? 'Hoje'
                    : proximaFidelidade?.dados?.dias_restantes < 0
                      ? 'Vencida'
                      : proximaFidelidade?.dados?.dias_restantes !== undefined
                        ? `${proximaFidelidade.dados.dias_restantes} dias`
                        : 'Ok'}
                </span>
              </button>

              <button
                type="button"
                className={`home-notification home-notification--fixed ${retornosNaoLidos ? 'is-unread' : ''} ${proximoRetorno?.nivel || 'warn'} ${notificacoesRetorno.length === 0 ? 'is-empty' : ''}`}
                disabled={notificacoesRetorno.length === 0}
                onClick={() => {
                  if (!proximoRetorno) return;
                  handleReadNotification(proximoRetorno);
                }}
              >
                <span className="home-notification__icon">
                  <I.AlertTriangle size={16} />
                </span>
                <span className="home-notification__content">
                  <em>Retornos</em>
                  <strong>
                    {notificacoesRetorno.length > 0
                      ? `${notificacoesRetorno.length} retorno${notificacoesRetorno.length === 1 ? '' : 's'} de ligação`
                      : 'Sem retornos pendentes'}
                  </strong>
                  <span>
                    {proximoRetorno
                      ? `Mais urgente: ${proximoRetorno.dados?.titulo_nota || 'nota'} - ${formatarRetornoResumo(proximoRetorno)}.`
                      : 'Nenhuma ligação pendente para acompanhar.'}
                  </span>
                </span>
                <span className="home-notification__days">
                  {retornosVencidos > 0 ? `${retornosVencidos} vencido${retornosVencidos === 1 ? '' : 's'}` : notificacoesRetorno.length > 0 ? 'Em breve' : 'Ok'}
                </span>
              </button>

              <button
                type="button"
                className={`home-notification home-notification--fixed home-notification--problem ${problemasNaoLidos ? 'is-unread' : ''} ${proximoProblema?.nivel || 'danger'} ${notificacoesProblema.length === 0 ? 'is-empty' : ''}`}
                disabled={notificacoesProblema.length === 0}
                onClick={() => proximoProblema && handleReadNotification(proximoProblema)}
              >
                <span className="home-notification__icon">
                  <I.AlertTriangle size={16} />
                </span>
                <span className="home-notification__content">
                  <em>Vendas com problema</em>
                  <strong>
                    {notificacoesProblema.length > 0
                      ? `${notificacoesProblema.length} venda${notificacoesProblema.length === 1 ? '' : 's'} exigindo ação`
                      : 'Nenhuma venda problemática'}
                  </strong>
                  <span>
                    {proximoProblema
                      ? proximoProblema.mensagem
                      : 'Tudo certo com as vendas acompanhadas.'}
                  </span>
                </span>
                <span className="home-notification__days">
                  {notificacoesProblema.length > 0 ? 'Urgente' : 'Ok'}
                </span>
              </button>
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
        {podeVerCampanhas && campanhasComProgresso.length > 0 && (
          <>
            <div className="rewards-header">
              <div>
                <h2>Campanhas</h2>
                <p>
                  Bata cada campanha para liberar uma recompensa surpresa.
                </p>
              </div>

              <div className="rewards-progress-summary">
                <span>Progresso de campanhas</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${overallPct}%` }} />
                </div>
                <strong>{doneCount}/{totalCount}</strong>
              </div>
            </div>

            <div className="rewards-grid">
              {campanhasComProgresso.map((campanha, i) => {
                const isClaimed = openedGifts.has(campanha.id);
                const isClaiming = claimingId === campanha.id;
                const remaining = Math.max(0, campanha.target - campanha.current);
                return (
                  <div key={campanha.id} className={`reward-card ${campanha.achieved ? 'achieved' : ''} ${isClaimed ? 'claimed' : ''}`}>
                    <div className="reward-top">
                      <div className="reward-icon">{isClaimed ? '✅' : campanha.achieved ? '🎉' : '🎁'}</div>
                      <div className="reward-step">Campanha {i + 1}</div>
                      <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}>
                        {getCampanhaScope(campanha)}
                      </span>
                      {campanha.achieved && !isClaimed && (
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
                    
                    <div className="reward-name">{campanha.desc}</div>
                    {isClaimed && campanha.reward && (
                      <div className="reward-claimed-prize">
                        Prêmio ganho: {campanha.reward}
                      </div>
                    )}

                    <div className="reward-progress">
                      <div className="progress-track" style={{ height: 8 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${campanha.pct}%`,
                            background: campanha.achieved ? 'var(--success)' : 'var(--text)'
                          }}
                        />
                      </div>
                      <div className="reward-numbers">
                        <span>
                          {formatGoalValue(campanha, campanha.current)}
                          <span> / {formatGoalValue(campanha, campanha.target)}</span>
                        </span>
                        <span>{campanha.pct}%</span>
                      </div>
                    </div>

                    <button
                      className={`btn ${campanha.achieved && !isClaimed ? 'btn-primary' : ''}`}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      disabled={!campanha.achieved || isClaimed || isClaiming}
                      onClick={() => handleOpenGift(campanha)}
                    >
                      {isClaiming
                        ? 'Resgatando...'
                        : isClaimed
                        ? <><I.Check size={13} /> Resgatada</>
                        : campanha.achieved
                          ? 'Resgatar surpresa 🎁'
                          : `Faltam ${formatGoalValue(campanha, remaining)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {podeVerCampanhasUsuarios && progressoUsuarios.length > 0 && (
          <section className="team-goals">
            <div className="team-goals__header">
              <div>
                <h2>Campanhas por usuário</h2>
                <p>Acompanhe quem ja bateu as campanhas e quem ainda esta pendente.</p>
              </div>

              <div className="team-goals__filters">
                <label className="team-goals__filter">
                  <span>Buscar</span>
                  <input
                    value={usuarioCampanhaBusca}
                    onChange={event => setUsuarioCampanhaBusca(event.target.value)}
                    placeholder="Nome ou e-mail"
                  />
                </label>

                <label className="team-goals__filter">
                  <span>Usuário</span>
                  <select value={usuarioCampanhaFiltro} onChange={event => setUsuarioCampanhaFiltro(event.target.value)}>
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
                const drawerOpen = isTeamGoalDrawerOpen(item.id);
                const drawerId = `team-goal-drawer-${item.id}`;
                const TeamGoalHeader = teamGoalMobileLayout ? 'button' : 'div';
                const teamGoalHeaderProps = teamGoalMobileLayout
                  ? {
                      type: 'button',
                      'aria-expanded': drawerOpen,
                      'aria-controls': drawerId,
                      onClick: () => toggleTeamGoalDrawer(item.id)
                    }
                  : {};

                return (
                  <article key={item.id} className={`team-goal-card ${drawerOpen ? 'is-open' : ''}`}>
                    <TeamGoalHeader className="team-goal-card__top" {...teamGoalHeaderProps}>
                      <div className="mini-avatar">
                        {item.foto_perfil ? (
                          <img src={item.foto_perfil} alt={item.nome || 'Usuário'} />
                        ) : (
                          getInitials(item.nome)
                        )}
                      </div>
                      <div>
                        <strong>{item.nome}</strong>
                        <span>{atingidas}/{total} campanhas atingidas · {item.resumo?.resgatadas || 0} resgatadas</span>
                      </div>
                      <b>{pct}%</b>
                      {teamGoalMobileLayout && (
                        <span className="team-goal-card__chevron" aria-hidden="true">
                          <I.ChevronDown size={14} />
                        </span>
                      )}
                    </TeamGoalHeader>

                    <div id={drawerId} className="team-goal-card__drawer">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="team-goal-list">
                      {(item.campanhas || []).map(campanha => (
                        <div key={campanha.id} className={`team-goal-item ${campanha.achieved ? 'is-achieved' : ''}`}>
                          <span className="team-goal-item__status">
                            {campanha.claimed ? <I.Check size={12} /> : campanha.achieved ? <I.Check size={12} /> : `${campanha.pct}%`}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{campanha.desc}</strong>
                            <span>
                              {formatGoalValue(campanha, campanha.current)} / {formatGoalValue(campanha, campanha.target)}
                              {campanha.operadora_nome ? ` · ${campanha.operadora_nome}` : ''}
                            </span>
                            {campanha.claimed && campanha.reward && (
                              <em>Premio ganho: {campanha.reward}</em>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
