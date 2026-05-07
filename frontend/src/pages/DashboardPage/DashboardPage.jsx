import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getCampanhas, getProgresso, getProgressoUsuarios, resgatarCampanha } from '../../services/campanha.service';
import { obterResumoVendas } from '../../services/venda.service';
import { listarNotificacoes, marcarNotificacaoLida } from '../../services/notificacao.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import * as I from '../../components/Icons';
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
};

const CATEGORY_LABELS = {
  registro_cliente: 'Registro de cliente',
  chip_novo: 'Chip novo',
  portabilidade: 'Portabilidade',
  internet: 'Internet',
};

const TIPOS_RETORNO_NOTA = ['nota_retorno_pre', 'nota_retorno_due'];
const TIPOS_PROBLEMA_VENDA = ['venda_problema_aberto', 'venda_problema_resolvido', 'venda_problema_correcao'];

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

    if (TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo)) {
      return `/vendas?venda_id=${vendaId}&aba=problema`;
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
  const data = new Date(String(valor || '').replace(' ', 'T'));

  return Number.isNaN(data.getTime()) ? Number.MAX_SAFE_INTEGER : data.getTime();
}

function formatarRetornoResumo(notificacao) {
  const valor = notificacao?.dados?.retorno_agendado_para;
  if (!valor) return 'sem data definida';

  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return 'sem data definida';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarPrazoRelativo(valor) {
  if (!valor) return 'Pendente';

  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return 'Pendente';

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

function getFidelidadePrazo(notificacao) {
  const dias = Number(notificacao?.dados?.dias_restantes);
  if (!Number.isFinite(dias)) return 'Sem data';
  if (dias < 0) return `Vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoje';
  return `Vence em ${dias} dias`;
}

function getRetornoPrazo(notificacao) {
  if (notificacao?.tipo === 'nota_retorno_due') return formatarRetornoResumo(notificacao);
  return formatarRetornoResumo(notificacao);
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
  const podeVerResumoVendas = temPermissao(usuario, 'dashboard_resumo_vendas');
  const podeVerRetornos = temPermissao(usuario, ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas']);
  const podeVerCampanhasUsuarios = temPermissao(usuario, 'campanhas_ver_usuarios');
  const podeVerNotificacoes = Boolean(usuario) || temPermissao(usuario, 'notificacoes_visualizar');

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), feedback.type === 'success' ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    getCampanhas().then(setCampanhas).catch(console.error);

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
    if (!podeVerCampanhasUsuarios) return undefined;

    getProgressoUsuarios()
      .then(data => setProgressoUsuarios(data.usuarios || []))
      .catch(console.error);
  }, [podeVerCampanhasUsuarios]);

  useEffect(() => {
    if (!podeVerNotificacoes) {
      return undefined;
    }

    listarNotificacoes({ limit: 24 })
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

  const firstName = usuario?.nome?.split(' ')[0] || 'você';
  const notificacoesFidelidade = notificacoes
    .filter(notificacao => notificacao.tipo === 'cliente_fidelidade')
    .sort((a, b) => Number(a.dados?.dias_restantes ?? 999) - Number(b.dados?.dias_restantes ?? 999));
  const notificacoesRetorno = notificacoes
    .filter(notificacao => TIPOS_RETORNO_NOTA.includes(notificacao.tipo))
    .sort((a, b) => getRetornoTimestamp(a) - getRetornoTimestamp(b));
  const notificacoesProblema = notificacoes
    .filter(notificacao => TIPOS_PROBLEMA_VENDA.includes(notificacao.tipo))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const notificacaoCards = [
    {
      key: 'retornos',
      title: 'Retornos',
      subtitle: 'Chips devolvidos',
      count: notificacoesRetorno.length,
      variant: 'danger',
      icon: <I.AlertTriangle size={15} />,
      items: notificacoesRetorno.slice(0, 3),
      metric: notificacao => notificacao.tipo === 'nota_retorno_due' ? 'Retorno vencido' : getRetornoPrazo(notificacao),
      actionLabel: 'Ver todos os retornos',
      onAction: () => navigate('/retornos')
    },
    {
      key: 'fidelidade',
      title: 'Fim de fidelidade',
      subtitle: 'Próximos 30 dias',
      count: notificacoesFidelidade.length,
      variant: 'warn',
      icon: <I.History size={15} />,
      items: notificacoesFidelidade.slice(0, 3),
      metric: getFidelidadePrazo,
      actionLabel: 'Iniciar abordagem de renovação',
      onAction: () => navigate('/clientes?fidelidade=alerta')
    },
    {
      key: 'problemas',
      title: 'Vendas com problema',
      subtitle: 'Precisam de ação',
      count: notificacoesProblema.length,
      variant: 'info',
      icon: <I.AlertTriangle size={15} />,
      items: notificacoesProblema.slice(0, 3),
      metric: notificacao => formatarPrazoRelativo(notificacao.updated_at),
      actionLabel: 'Resolver pendências',
      onAction: () => {
        if (notificacoesProblema[0]) {
          handleReadNotification(notificacoesProblema[0]);
          return;
        }
        navigate('/vendas');
      }
    }
  ];
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

        {(notificacoesFidelidade.length > 0 || notificacoesRetorno.length > 0 || notificacoesProblema.length > 0) && (
          <section className="home-notifications">
            <div className="home-notifications__header">
              <div>
                <h2>Notificações</h2>
                <p>Acompanhe os pontos que exigem atenção imediata.</p>
              </div>
            </div>

            <div className="home-notifications__list">
              {notificacaoCards.map(card => (
                <article key={card.key} className={`home-notification-card home-notification-card--${card.variant}`}>
                  <div className="home-notification-card__top">
                    <span className="home-notification-card__icon">{card.icon}</span>
                    <span className="home-notification-card__title">
                      <strong>{card.title}</strong>
                      <em>{card.subtitle}</em>
                    </span>
                    <span className="home-notification-card__count">{card.count}</span>
                  </div>

                  <div className="home-notification-card__items">
                    {card.items.length === 0 ? (
                      <div className="home-notification-card__empty">Nenhuma notificação ativa.</div>
                    ) : card.items.map(notificacao => (
                      <button
                        type="button"
                        key={notificacao.destinatario_id || notificacao.id}
                        className={`home-notification-card__item ${notificacao.lida ? '' : 'is-unread'}`}
                        onClick={() => handleReadNotification(notificacao)}
                      >
                        <strong>{getNotificacaoTitulo(notificacao)}</strong>
                        <span>{getNotificacaoDescricao(notificacao)}</span>
                        <em>{card.metric(notificacao)}</em>
                      </button>
                    ))}
                  </div>

                  <button type="button" className="home-notification-card__action" disabled={card.count === 0} onClick={card.onAction}>
                    {card.actionLabel} <I.ArrowRight size={13} />
                  </button>
                </article>
              ))}
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
        {campanhasComProgresso.length > 0 && (
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
                        <span>{atingidas}/{total} campanhas atingidas · {item.resumo?.resgatadas || 0} resgatadas</span>
                      </div>
                      <b>{pct}%</b>
                    </div>

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
