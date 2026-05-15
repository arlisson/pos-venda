import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { listarAuditLogs, listarStatusVendasHistorico } from '../../services/audit-log.service';
import { listarEtapasFunil } from '../../services/config.service';
import { formatUtcDateTime, getUtcDateTimeTimestamp } from '../../utils/datetime';

const ACAO_LABELS = {
  'auth.login': 'Login realizado',
  'auth.login_falha': 'Falha no login',
  'auth.perfil_atualizado': 'Perfil atualizado',
  'usuario.criado': 'Usuário criado',
  'usuario.atualizado': 'Usuário atualizado',
  'usuario.excluido': 'Usuário excluído',
  'venda.criada': 'Venda criada',
  'venda.atualizada': 'Venda atualizada',
  'venda.status_atualizado': 'Status da venda atualizado',
  'venda.enviada_pos_venda': 'Venda enviada ao pós-venda',
  'venda.retorno_registrado': 'Venda em retorno',
  'venda.retorno_corrigido': 'Retorno corrigido',
  'venda.enviada_lixeira': 'Venda enviada para lixeira',
  'venda.restaurada': 'Venda restaurada',
  'venda.excluida_definitivamente': 'Venda excluída definitivamente',
  'venda.enviada_pos_venda': 'Venda enviada para pós-venda',
};

const FUNIL_STAGES = [
  { id: 'aprovacao', name: 'Aprovação' },
  { id: 'ativacao', name: 'Ativação' },
  { id: 'envio', name: 'Envio' },
  { id: 'entrega', name: 'Entrega' },
  { id: 'confirmacao', name: 'Confirmação' },
  { id: 'concluido', name: 'Concluído' },
];

const FUNIL_STAGE_IDS = FUNIL_STAGES.map(s => s.id);

const STAGE_NAMES_MAP = Object.fromEntries(FUNIL_STAGES.map(s => [s.id, s.name]));
STAGE_NAMES_MAP.retorno = 'Retorno';

function parseDados(dados) {
  if (!dados) return {};
  if (typeof dados === 'object') return dados;

  try {
    return JSON.parse(dados);
  } catch {
    return {};
  }
}

function formatarData(valor) {
  return formatUtcDateTime(valor, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarAcao(acao) {
  return ACAO_LABELS[acao] || acao.replaceAll('.', ' ');
}

function normalizarEtapas(etapas = []) {
  return etapas
    .map((etapa, index) => ({
      id: etapa.codigo || etapa.id,
      nome: etapa.nome || etapa.name || etapa.codigo || etapa.id,
      ordem: Number(etapa.ordem ?? index),
      etapaFinal: Boolean(etapa.etapa_final || etapa.etapaFinal)
    }))
    .filter(etapa => etapa.id)
    .sort((a, b) => a.ordem - b.ordem);
}

function getMovimentacaoHistorico(log) {
  const dados = parseDados(log.dados);
  const movimentacao = dados?.movimentacao || {};

  return {
    statusAnterior: movimentacao.status_anterior
      || dados?.status_anterior
      || dados?.alteracoes?.status_anterior
      || null,
    statusNovo: movimentacao.status_novo
      || dados?.status_funil
      || dados?.alteracoes?.status_funil
      || dados?.payload?.status_funil
      || dados?.venda?.status_funil
      || null
  };
}

function calcularEtapasPuladas(statusAnterior, statusNovo, etapas = []) {
  if (!statusAnterior || !statusNovo || statusAnterior === statusNovo) return [];
  if (statusAnterior === 'retorno' || statusNovo === 'retorno') return [];

  const origem = etapas.findIndex(etapa => etapa.id === statusAnterior);
  const destino = etapas.findIndex(etapa => etapa.id === statusNovo);

  if (origem < 0 || destino < 0 || destino <= origem + 1) return [];

  return etapas.slice(origem + 1, destino);
}

function enriquecerGrupoComPulos(grupo, etapas = []) {
  const primeiraEtapa = etapas[0]?.id || null;
  let statusAtual = null;

  const logs = grupo.logs.map(log => {
    const { statusAnterior, statusNovo } = getMovimentacaoHistorico(log);
    const origem = statusAnterior || statusAtual || (statusNovo ? primeiraEtapa : null);
    const etapasPuladas = calcularEtapasPuladas(origem, statusNovo, etapas);

    if (statusNovo) {
      statusAtual = statusNovo;
    }

    return {
      ...log,
      statusAnteriorInferido: origem,
      statusNovoInferido: statusNovo,
      etapasPuladas
    };
  });

  return { ...grupo, logs };
}

function montarDetalhe(log) {
  const dados = parseDados(log.dados);
  const partes = [];

  if (log.entidade_id) {
    partes.push(`#${log.entidade_id}`);
  }

  if (dados?.usuario?.nome) {
    partes.push(dados.usuario.nome);
  } else if (dados?.alteracoes?.email) {
    partes.push(dados.alteracoes.email);
  } else if (dados?.email) {
    partes.push(dados.email);
  }

  return partes.length ? ` · ${partes.join(' ')}` : '';
}

function getTipo(log) {
  if (log.acao?.includes('falha')) return 'danger';
  if (log.acao === 'venda.excluida_definitivamente') return 'deleted';
  if (log.acao === 'venda.enviada_lixeira') return 'trash';
  if (log.acao === 'venda.restaurada') return 'restore';
  if (log.acao?.includes('login')) return 'neutral';
  return 'success';
}

function MarkerIcon({ log, size = 12 }) {
  switch (log.acao) {
    case 'venda.enviada_lixeira':
      return <I.TrashSend size={size} />;
    case 'venda.restaurada':
      return <I.TrashRestore size={size} />;
    case 'venda.excluida_definitivamente':
      return <I.Trash size={size} />;
    default:
      if (log.acao?.includes('falha')) return <I.AlertTriangle size={size} />;
      return <I.Check size={size} />;
  }
}

function HistoricoItem({ log, selecionado, compacto, onClick }) {
  const tipo = getTipo(log);
  const usuario = log.usuario?.nome || (log.usuario_id ? `Usuário #${log.usuario_id}` : 'Sistema');

  return (
    <div 
      className={`history-item ${compacto ? 'history-item--compact' : ''} ${tipo} ${selecionado ? 'selected' : ''}`}
      onClick={() => onClick(log)}
      style={{ cursor: 'pointer' }}
    >
      <div className="history-marker">
        <MarkerIcon log={log} size={12} />
      </div>
      <div className="history-content">
        {compacto ? (
          <div className="history-main-line">
            <div className="history-title">
              <strong>{formatarAcao(log.acao)}</strong>
              <span>{montarDetalhe(log)}</span>
            </div>
            <div className="history-meta">
              <span>{usuario}</span>
              <span>·</span>
              <span>{log.metodo || 'API'} {log.rota || ''}</span>
              <span>·</span>
              <span>{formatarData(log.created_at)}</span>
            </div>
          </div>
        ) : (
        <>
        <div className="history-title">
          <strong>{formatarAcao(log.acao)}</strong>
          <span>{montarDetalhe(log)}</span>
        </div>
        <div className="history-meta">
          <span>{usuario}</span>
          <span>·</span>
          <span>{log.metodo || 'API'} {log.rota || ''}</span>
          <span>·</span>
          <span>{formatarData(log.created_at)}</span>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function extrairNomeVenda(logs, vendaId) {
  for (const log of logs) {
    const dados = parseDados(log.dados);

    if (log.acao === 'venda.criada') {
      const v = dados.venda;
      if (v) return v.razao_social || v.nome || null;
    }

    if (log.acao === 'venda.atualizada') {
      const alt = dados.alteracoes;
      if (alt) return alt.razao_social || alt.nome || null;
    }
  }

  return `Venda #${vendaId}`;
}

function buildStageProgression(logs) {
  const sorted = [...logs].sort((a, b) => getUtcDateTimeTimestamp(a.created_at) - getUtcDateTimeTimestamp(b.created_at));

  const reached = new Map();
  let currentStage = null;
  let hasRetorno = false;

  for (const log of sorted) {
    const dados = parseDados(log.dados);
    const usuario = log.usuario?.nome || (log.usuario_id ? `Usuário #${log.usuario_id}` : 'Sistema');

    if (log.acao === 'venda.criada') {
      if (!reached.has('aprovacao')) {
        reached.set('aprovacao', { data: log.created_at, usuario, log });
      }
      currentStage = 'aprovacao';
    } else if (log.acao === 'venda.status_atualizado') {
      const stage = dados.alteracoes?.status_funil;
      if (stage === 'retorno') {
        hasRetorno = true;
      } else if (stage && FUNIL_STAGE_IDS.includes(stage)) {
        if (!reached.has(stage)) {
          reached.set(stage, { data: log.created_at, usuario, log });
        }
        currentStage = stage;
      }
    }
  }

  if (!currentStage) currentStage = 'aprovacao';

  const stages = FUNIL_STAGES.map((stage, idx) => {
    const stageData = reached.get(stage.id);
    const isCurrent = stage.id === currentStage;
    const isReached = reached.has(stage.id);

    let status;
    if (isCurrent) {
      status = 'current';
    } else if (isReached) {
      status = 'done';
    } else {
      const hasBefore = FUNIL_STAGE_IDS.slice(0, idx).some(id => reached.has(id));
      const hasAfter = FUNIL_STAGE_IDS.slice(idx + 1).some(id => reached.has(id));
      status = (hasBefore && hasAfter) ? 'skipped' : 'pending';
    }

    return { ...stage, status, data: stageData?.data, usuario: stageData?.usuario, log: stageData?.log };
  });

  return { stages, hasRetorno, currentStage };
}

function getConnectorType(stageA, stageB) {
  if (stageA.status === 'skipped' || stageB.status === 'skipped') return 'skip';
  if (
    (stageA.status === 'done' || stageA.status === 'current') &&
    (stageB.status === 'done' || stageB.status === 'current')
  ) return 'done';
  return 'pending';
}

function FunilTracker({ progression, logSelecionado, onClickLog }) {
  const { stages, hasRetorno } = progression;

  return (
    <div className="funil-tracker" role="list" aria-label="Progresso no funil">
      {stages.map((stage, idx) => {
        const isClickable = !!stage.log;
        const isSelected = stage.log && logSelecionado?.id === stage.log.id;
        const connectorType = idx < stages.length - 1
          ? getConnectorType(stage, stages[idx + 1])
          : null;

        return (
          <div
            key={stage.id}
            className={`funil-stage funil-stage--${stage.status}`}
            role="listitem"
            data-connector={connectorType}
          >
            <button
              type="button"
              className={`funil-stage__btn${isSelected ? ' selected' : ''}`}
              onClick={() => isClickable && onClickLog(stage.log)}
              disabled={!isClickable}
              title={stage.status === 'skipped' ? `Etapa pulada: ${stage.name}` : stage.name}
            >
              <div className="funil-stage__dot">
                {stage.status === 'done' && <I.Check size={10} />}
                {stage.status === 'current' && <span className="funil-stage__inner" />}
                {stage.status === 'skipped' && <I.AlertTriangle size={10} />}
              </div>
              <span className="funil-stage__name">{stage.name}</span>
              {stage.data && (
                <span className="funil-stage__date">{formatarData(stage.data)}</span>
              )}
            </button>
          </div>
        );
      })}
      {hasRetorno && (
        <div className="funil-retorno-flag" title="Esta venda teve retorno registrado">
          <I.AlertTriangle size={10} />
          <span>Retorno</span>
        </div>
      )}
    </div>
  );
}

function getGrupoVendaId(log) {
  if (log.entidade_id) return String(log.entidade_id);

  const dados = parseDados(log.dados);
  return String(dados?.venda?.id || dados?.venda_id || log.id);
}

function agruparLogsVenda(logs = []) {
  const grupos = new Map();

  logs.forEach(log => {
    const vendaId = getGrupoVendaId(log);
    const grupoAtual = grupos.get(vendaId) || {
      vendaId,
      logs: []
    };

    grupoAtual.logs.push(log);
    grupos.set(vendaId, grupoAtual);
  });

  return Array.from(grupos.values()).map(grupo => ({
    ...grupo,
    logs: grupo.logs.sort((a, b) => getUtcDateTimeTimestamp(a.created_at) - getUtcDateTimeTimestamp(b.created_at)),
    maisRecente: grupo.logs.reduce((recente, log) => (
      !recente || getUtcDateTimeTimestamp(log.created_at) > getUtcDateTimeTimestamp(recente.created_at) ? log : recente
    ), null)
  })).sort((a, b) => getUtcDateTimeTimestamp(b.maisRecente?.created_at) - getUtcDateTimeTimestamp(a.maisRecente?.created_at));
}

function VendaHistoricoGrupo({ grupo, logSelecionado, onClick }) {
  const [expandido, setExpandido] = useState(false);
  const progression = buildStageProgression(grupo.logs);
  const currentStageName = STAGE_NAMES_MAP[progression.currentStage] || progression.currentStage;
  const skippedCount = progression.stages.filter(s => s.status === 'skipped').length;
  const nomeCliente = extrairNomeVenda(grupo.logs, grupo.vendaId);

  return (
    <div className="history-sale-row">
      <div className="history-sale-row__head">
        <strong className="history-sale-row__client" title={nomeCliente}>{nomeCliente}</strong>
        <span className="history-sale-row__id">#{grupo.vendaId}</span>
        <span className="history-sale-row__stage-badge">{currentStageName}</span>
        {skippedCount > 0 && (
          <span className="history-sale-row__tag tag-skipped">
            <I.AlertTriangle size={9} /> {skippedCount} pulada{skippedCount > 1 ? 's' : ''}
          </span>
        )}
        {progression.hasRetorno && (
          <span className="history-sale-row__tag tag-retorno">
            <I.AlertTriangle size={9} /> Retorno
          </span>
        )}
        <button
          type="button"
          className={`history-sale-row__events-toggle${expandido ? ' open' : ''}`}
          onClick={() => setExpandido(v => !v)}
          title={expandido ? 'Ocultar eventos' : 'Ver eventos'}
        >
          <I.ChevronDown size={12} />
          <span>{grupo.logs.length} eventos</span>
        </button>
      </div>

      <div className="history-sale-row__body">
        <FunilTracker
          progression={progression}
          logSelecionado={logSelecionado}
          onClickLog={onClick}
        />

        {expandido && (
          <div className="history-sale-row__scroll" role="list" aria-label={`Eventos da venda ${grupo.vendaId}`}>
            {grupo.logs.map((log, index) => {
              const tipo = getTipo(log);
              const usuario = log.usuario?.nome || (log.usuario_id ? `Usuário #${log.usuario_id}` : 'Sistema');
              const selecionado = logSelecionado?.id === log.id;

              return (
                <button
                  key={log.id}
                  type="button"
                  className={`history-sale-step ${tipo} ${selecionado ? 'selected' : ''}`}
                  onClick={() => onClick(log)}
                  role="listitem"
                >
                  <span className="history-sale-step__marker">
                    <MarkerIcon log={log} size={11} />
                  </span>
                  <span className="history-sale-step__body">
                    <strong>{formatarAcao(log.acao)}</strong>
                    <small>{usuario} · {formatarData(log.created_at)}</small>
                  </span>
                  {index < grupo.logs.length - 1 && <span className="history-sale-step__line" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DetalheCard({ log, onClose }) {
  const dados = parseDados(log.dados);
  const stageDe = dados.alteracoes?.status_funil
    ? STAGE_NAMES_MAP[dados.alteracoes?.status_funil]
    : null;

  return (
    <div className="history-detail-card">
      <div className="history-detail-header">
        <h3>Detalhes do Registro</h3>
        <button className="history-detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>

      <div className="history-detail-body">
        <div className="history-detail-row">
          <span className="history-detail-label">Ação:</span>
          <span className="history-detail-value">{formatarAcao(log.acao)}</span>
        </div>

        {stageDe && (
          <div className="history-detail-row">
            <span className="history-detail-label">Etapa do funil:</span>
            <span className="history-detail-value">{stageDe}</span>
          </div>
        )}

        {dados.alteracoes?.observacao && (
          <div className="history-detail-row">
            <span className="history-detail-label">Observação:</span>
            <span className="history-detail-value">{dados.alteracoes.observacao}</span>
          </div>
        )}

        <div className="history-detail-row">
          <span className="history-detail-label">Usuário:</span>
          <span className="history-detail-value">
            {log.usuario?.nome || (log.usuario_id ? `Usuário #${log.usuario_id}` : 'Sistema')}
          </span>
        </div>

        <div className="history-detail-row">
          <span className="history-detail-label">Data/Hora:</span>
          <span className="history-detail-value">{formatarData(log.created_at)}</span>
        </div>

        <div className="history-detail-row">
          <span className="history-detail-label">Método:</span>
          <span className="history-detail-value">{log.metodo || 'API'}</span>
        </div>

        <div className="history-detail-row">
          <span className="history-detail-label">Rota:</span>
          <span className="history-detail-value">{log.rota || 'N/A'}</span>
        </div>

        {log.entidade && (
          <div className="history-detail-row">
            <span className="history-detail-label">Entidade:</span>
            <span className="history-detail-value">{log.entidade}</span>
          </div>
        )}

        {log.entidade_id && (
          <div className="history-detail-row">
            <span className="history-detail-label">ID da Entidade:</span>
            <span className="history-detail-value">#{log.entidade_id}</span>
          </div>
        )}

        {log.etapasPuladas?.length > 0 && (
          <div className="history-detail-section history-detail-section--warning">
            <h4>Etapas puladas no funil</h4>
            <div className="history-skipped-detail">
              <I.AlertTriangle size={15} />
              <span>{log.etapasPuladas.map(etapa => etapa.nome).join(', ')}</span>
            </div>
          </div>
        )}
        
        {dados && Object.keys(dados).length > 0 && (
          <div className="history-detail-section">
            <h4>Dados da Operação</h4>
            <pre className="history-detail-data">
              {JSON.stringify(dados, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricoPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [logSelecionado, setLogSelecionado] = useState(null);
  const [etapasFunil, setEtapasFunil] = useState([]);
  const [vendasAtivasIds, setVendasAtivasIds] = useState(() => new Set());
  const [vendasLixeiraIds, setVendasLixeiraIds] = useState(() => new Set());

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro('');

      try {
        const [dados, etapas, statusVendas] = await Promise.all([
          listarAuditLogs({ busca, limite: 500 }),
          listarEtapasFunil().catch(() => []),
          listarStatusVendasHistorico().catch(() => ({ ativas: [], lixeira: [] }))
        ]);
        setLogs(dados);
        setEtapasFunil(normalizarEtapas(etapas));
        setVendasAtivasIds(new Set((statusVendas?.ativas || []).map(id => String(id))));
        setVendasLixeiraIds(new Set((statusVendas?.lixeira || []).map(id => String(id))));
      } catch (error) {
        setErro(error.message || 'Erro ao carregar histórico.');
      } finally {
        setCarregando(false);
      }
    }

    const timer = setTimeout(carregar, 250);

    return () => clearTimeout(timer);
  }, [busca]);

  const logsFiltrados = useMemo(() => {
    if (filtro === 'todos') return logs;

    return logs.filter(log => {
      if (filtro === 'usuarios') return log.entidade === 'usuarios';
      if (filtro === 'vendas') return log.entidade === 'vendas';
      if (filtro === 'auth') return log.acao?.startsWith('auth.');
      if (filtro === 'falhas') return log.acao?.includes('falha');
      return true;
    });
  }, [logs, filtro]);

  const modoVendasCompacto = filtro === 'vendas';
  const gruposVenda = useMemo(() => {
    if (!modoVendasCompacto) return [];
    return agruparLogsVenda(logsFiltrados)
      .map(grupo => enriquecerGrupoComPulos(grupo, etapasFunil))
      .filter(grupo => vendasAtivasIds.has(grupo.vendaId));
  }, [modoVendasCompacto, logsFiltrados, etapasFunil, vendasAtivasIds]);

  return (
    <LayoutPrivado>
      <div className="history-page">
        <div className="history-toolbar">
          <div className="history-search">
            <I.Search size={14} />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar ação, usuário, rota..."
            />
          </div>

          <div className="history-filters" aria-label="Filtros do histórico">
            {[
              ['todos', 'Todos'],
              ['vendas', 'Vendas'],
              ['usuarios', 'Usuários'],
              ['auth', 'Acessos'],
              ['falhas', 'Falhas']
            ].map(([id, label]) => (
              <button
                key={id}
                className={`filter-chip ${filtro === id ? 'active' : ''}`}
                onClick={() => setFiltro(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="history-lixeira-link"
            onClick={() => navigate('/historico/lixeira')}
            title="Ver histórico de vendas excluídas"
          >
            <I.Trash size={13} />
            Lixeira
          </button>
        </div>

        <div className="history-shell">
          <div className="history-summary">
            {modoVendasCompacto
              ? `Registros de vendas (${logsFiltrados.length} eventos em ${gruposVenda.length} vendas)`
              : `Linha do tempo de todas as movimentacoes (${logsFiltrados.length} eventos)`}
          </div>

          <div className="history-panel">
            {carregando ? (
              <div className="history-empty">Carregando histórico...</div>
            ) : erro ? (
              <div className="history-empty error">{erro}</div>
            ) : logsFiltrados.length === 0 ? (
              <div className="history-empty">Nenhuma movimentacao encontrada.</div>
            ) : modoVendasCompacto ? (
              <div className="history-sale-groups">
                {gruposVenda.map(grupo => (
                  <VendaHistoricoGrupo
                    key={grupo.vendaId}
                    grupo={grupo}
                    logSelecionado={logSelecionado}
                    onClick={setLogSelecionado}
                  />
                ))}
              </div>
            ) : (
              <div className={`history-list ${modoVendasCompacto ? 'history-list--compact' : ''}`}>
                {logsFiltrados.map(log => (
                  <HistoricoItem 
                    key={log.id} 
                    log={log} 
                    compacto={modoVendasCompacto}
                    selecionado={logSelecionado?.id === log.id}
                    onClick={setLogSelecionado}
                  />
                ))}
              </div>
            )}
            
            {logSelecionado && (
              <DetalheCard 
                log={logSelecionado} 
                onClose={() => setLogSelecionado(null)} 
              />
            )}
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default HistoricoPage;

