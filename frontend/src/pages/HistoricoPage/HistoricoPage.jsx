import React, { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { listarAuditLogs } from '../../services/audit-log.service';

const ACAO_LABELS = {
  'auth.login': 'Login realizado',
  'auth.login_falha': 'Falha no login',
  'auth.perfil_atualizado': 'Perfil atualizado',
  'usuario.criado': 'Usuario criado',
  'usuario.atualizado': 'Usuario atualizado',
  'usuario.excluido': 'Usuario excluido'
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

function HistoricoItem({ log }) {
  const tipo = getTipo(log);
  const usuario = log.usuario?.nome || (log.usuario_id ? `Usuario #${log.usuario_id}` : 'Sistema');

  return (
    <div className={`history-item ${tipo}`}>
      <div className="history-marker">
        {tipo === 'danger' ? <I.AlertTriangle size={12} /> : <I.Check size={12} />}
      </div>
      <div className="history-content">
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
    </div>
  );
}

function HistoricoPage() {
  const [logs, setLogs] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro('');

      try {
        const dados = await listarAuditLogs({ busca, limite: 160 });
        setLogs(dados);
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
      if (filtro === 'auth') return log.acao?.startsWith('auth.');
      if (filtro === 'falhas') return log.acao?.includes('falha');
      return true;
    });
  }, [logs, filtro]);

  return (
    <LayoutPrivado>
      <div className="history-page">
        <div className="history-toolbar">
          <div className="history-search">
            <I.Search size={14} />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar acao, usuario, rota..."
            />
          </div>

          <div className="history-filters" aria-label="Filtros do historico">
            {[
              ['todos', 'Todos'],
              ['usuarios', 'Usuarios'],
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
            Linha do tempo de todas as movimentacoes ({logsFiltrados.length} eventos)
          </div>

          <div className="history-panel">
            {carregando ? (
              <div className="history-empty">Carregando histórico...</div>
            ) : erro ? (
              <div className="history-empty error">{erro}</div>
            ) : logsFiltrados.length === 0 ? (
              <div className="history-empty">Nenhuma movimentacao encontrada.</div>
            ) : (
              <div className="history-list">
                {logsFiltrados.map(log => (
                  <HistoricoItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default HistoricoPage;

