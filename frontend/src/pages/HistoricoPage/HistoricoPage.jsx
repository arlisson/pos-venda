import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { listarAuditLogs } from '../../services/audit-log.service';
import { listarEtapasFunil } from '../../services/config.service';

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
  'venda.excluida_definitivamente': 'Venda excluída definitivamente'
};

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
  if (!valor) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(valor));
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
  if (log.acao?.includes('login')) return 'neutral';
  return 'success';
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
        {tipo === 'danger' ? <I.AlertTriangle size={12} /> : <I.Check size={12} />}
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
              <span>Â·</span>
              <span>{log.metodo || 'API'} {log.rota || ''}</span>
              <span>Â·</span>
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
    logs: grupo.logs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    maisRecente: grupo.logs.reduce((recente, log) => (
      !recente || new Date(log.created_at) > new Date(recente.created_at) ? log : recente
    ), null)
  })).sort((a, b) => new Date(b.maisRecente?.created_at || 0) - new Date(a.maisRecente?.created_at || 0));
}

function VendaHistoricoGrupo({ grupo, logSelecionado, onClick }) {
  const pulos = grupo.logs.reduce((total, log) => total + (log.etapasPuladas?.length || 0), 0);

  return (
    <div className={`history-sale-row ${pulos > 0 ? 'history-sale-row--has-skips' : ''}`}>
      <div className="history-sale-row__head">
        <strong>Venda #{grupo.vendaId}</strong>
        <span>{grupo.logs.length} ações</span>
        {pulos > 0 && (
          <em>
            <I.AlertTriangle size={11} />
            {pulos} etapa{pulos === 1 ? '' : 's'} pulada{pulos === 1 ? '' : 's'}
          </em>
        )}
      </div>

      <div className="history-sale-row__scroll" role="list" aria-label={`Histórico da venda ${grupo.vendaId}`}>
        {grupo.logs.map((log, index) => {
          const tipo = getTipo(log);
          const usuario = log.usuario?.nome || (log.usuario_id ? `Usuário #${log.usuario_id}` : 'Sistema');
          const selecionado = logSelecionado?.id === log.id;
          const temPulo = log.etapasPuladas?.length > 0;

          return (
            <button
              key={log.id}
              type="button"
              className={`history-sale-step ${tipo} ${temPulo ? 'skipped' : ''} ${selecionado ? 'selected' : ''}`}
              onClick={() => onClick(log)}
              role="listitem"
              title={temPulo ? `Pulou: ${log.etapasPuladas.map(etapa => etapa.nome).join(', ')}` : undefined}
            >
              <span className="history-sale-step__marker">
                {temPulo || tipo === 'danger' ? <I.AlertTriangle size={11} /> : <I.Check size={11} />}
              </span>
              <span className="history-sale-step__body">
                <strong>{formatarAcao(log.acao)}</strong>
                <small>{usuario} · {formatarData(log.created_at)}</small>
                {temPulo && (
                  <small className="history-sale-step__skip">
                    Pulou {log.etapasPuladas.map(etapa => etapa.nome).join(', ')}
                  </small>
                )}
              </span>
              {index < grupo.logs.length - 1 && <span className="history-sale-step__line" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetalheCard({ log, onClose }) {
  const dados = parseDados(log.dados);

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
  const [logs, setLogs] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [logSelecionado, setLogSelecionado] = useState(null);
  const [etapasFunil, setEtapasFunil] = useState([]);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro('');

      try {
        const [dados, etapas] = await Promise.all([
          listarAuditLogs({ busca, limite: 160 }),
          listarEtapasFunil().catch(() => [])
        ]);
        setLogs(dados);
        setEtapasFunil(normalizarEtapas(etapas));
      } catch (error) {
        setErro(error.message || 'Erro ao carregar historico.');
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
  const gruposVenda = useMemo(() => (
    modoVendasCompacto
      ? agruparLogsVenda(logsFiltrados).map(grupo => enriquecerGrupoComPulos(grupo, etapasFunil))
      : []
  ), [modoVendasCompacto, logsFiltrados, etapasFunil]);

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

          <div className="history-filters" aria-label="Filtros do historico">
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

