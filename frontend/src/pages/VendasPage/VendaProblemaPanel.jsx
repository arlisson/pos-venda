import { useEffect, useState } from 'react';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import {
  listarProblemasVenda,
  resolverProblemaVenda,
  solicitarCorrecaoProblemaVenda,
  verificarProblemaVenda
} from '../../services/venda.service';

function formatarData(value) {
  if (!value) return '-';

  const texto = String(value).slice(0, 10);
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!partes) return value;

  const [, ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function getProblemaStatusLabel(status) {
  if (status === 'resolvido') return 'Aguardando verificacao';
  if (status === 'correcao_solicitada') return 'Correcao solicitada';
  return 'Problema aberto';
}

function getProblemaTitulo(problema) {
  const abertura = (problema.eventos || []).find(evento => evento.tipo === 'abertura');
  return abertura?.mensagem || `Problema #${problema.id}`;
}

function getResponsaveis(problema) {
  return (problema.destinatarios || []).map(item => item.usuario?.nome).filter(Boolean).join(', ') || '-';
}

function VendaProblemaCard({ problema, usuario, destacado, onAtualizar }) {
  const [mensagemResolucao, setMensagemResolucao] = useState('');
  const [mensagemCorrecao, setMensagemCorrecao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const usuarioId = Number(usuario?.id);
  const solicitanteId = Number(problema.solicitante_id);
  const responsavel = (problema.destinatarios || []).some(item => Number(item.usuario_id) === usuarioId);
  const solicitante = solicitanteId === usuarioId;
  const podeResolver = responsavel && problema.status !== 'resolvido';
  const podeRevisar = solicitante && problema.status === 'resolvido';
  const detalhesId = `problema-${problema.id}-detalhes`;

  async function executar(acao) {
    setErro('');
    setSalvando(true);

    try {
      let atualizado;

      if (acao === 'resolver') {
        atualizado = await resolverProblemaVenda(problema.id, { mensagem: mensagemResolucao });
        setMensagemResolucao('');
      } else if (acao === 'correcao') {
        atualizado = await solicitarCorrecaoProblemaVenda(problema.id, { mensagem: mensagemCorrecao });
        setMensagemCorrecao('');
      } else {
        atualizado = await verificarProblemaVenda(problema.id);
      }

      onAtualizar(problema.id, atualizado);
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    } catch (error) {
      setErro(error.message || 'Erro ao atualizar problema da venda.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <article className={`venda-problema-card ${destacado ? 'is-highlighted' : ''}`} id={`problema-${problema.id}`}>
      <button
        type="button"
        className="venda-problema-card-header"
        aria-expanded={detalhesAbertos}
        aria-controls={detalhesId}
        onClick={() => setDetalhesAbertos(aberto => !aberto)}
      >
        <div className="venda-problema-card-main">
          <span className={`venda-problema-status-badge status-${problema.status}`}>{getProblemaStatusLabel(problema.status)}</span>
          <span>{getProblemaTitulo(problema)}</span>
          <em>Solicitado por {problema.solicitante?.nome || 'usuario'} em {formatarData(problema.aberto_em)}</em>
        </div>
      </button>

      <div
        className={`venda-problema-detalhes ${detalhesAbertos ? 'is-open' : 'is-closed'}`}
        id={detalhesId}
        aria-hidden={!detalhesAbertos}
      >
        <div className="venda-problema-detalhes-inner">
          <div className="venda-problema-responsaveis">
            <strong>Responsaveis</strong>
            <span>{getResponsaveis(problema)}</span>
          </div>

          <div className="venda-problema-eventos">
            {(problema.eventos || []).map(evento => (
              <div key={evento.id} className="venda-problema-evento">
                <strong>{evento.usuario?.nome || 'Sistema'} - {evento.tipo}</strong>
                <span>{evento.mensagem}</span>
                <em>{formatarData(evento.created_at)}</em>
              </div>
            ))}
          </div>

          {erro && <div className="alert-error">{erro}</div>}

          {podeResolver && (
            <div className="venda-problema-action">
              <label>Mensagem de resolucao</label>
              <AutoResizeTextarea value={mensagemResolucao} onChange={event => setMensagemResolucao(event.target.value)} placeholder="Explique o que foi corrigido" />
              <button type="button" className="btn btn-primary" disabled={salvando || !mensagemResolucao.trim()} onClick={() => executar('resolver')}>
                Marcar resolvido
              </button>
            </div>
          )}

          {podeRevisar && (
            <div className="venda-problema-action">
              <div className="venda-problema-review-actions">
                <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => executar('verificar')}>
                  Verificado
                </button>
              </div>
              <label>Solicitar nova correcao</label>
              <AutoResizeTextarea value={mensagemCorrecao} onChange={event => setMensagemCorrecao(event.target.value)} placeholder="Descreva o que ainda precisa ser ajustado" />
              <button type="button" className="btn" disabled={salvando || !mensagemCorrecao.trim()} onClick={() => executar('correcao')}>
                Enviar correcao
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function VendaProblemaPanel({ venda, usuario, initialProblemaId }) {
  const [problemas, setProblemas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    if (!venda?.id) return;

    setCarregando(true);
    setErro('');

    try {
      setProblemas(await listarProblemasVenda(venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar problemas da venda.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venda?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!initialProblemaId || problemas.length === 0) return undefined;

    const timer = setTimeout(() => {
      document.getElementById(`problema-${initialProblemaId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);

    return () => clearTimeout(timer);
  }, [initialProblemaId, problemas.length]);

  function atualizarProblema(problemaId, atualizado) {
    setProblemas(prev => {
      if (atualizado?.status === 'verificado') {
        return prev.filter(item => Number(item.id) !== Number(problemaId));
      }

      return prev.map(item => Number(item.id) === Number(problemaId) ? atualizado : item);
    });
  }

  if (!venda?.id) {
    return <div className="venda-problema-empty">Salve a venda antes de acompanhar problemas.</div>;
  }

  if (carregando) {
    return <div className="venda-problema-empty">Carregando problemas da venda...</div>;
  }

  if (erro && problemas.length === 0) {
    return <div className="alert-error">{erro}</div>;
  }

  if (problemas.length === 0) {
    return <div className="venda-problema-empty">Nenhum problema ativo para esta venda.</div>;
  }

  return (
    <div className="venda-problema-panel">
      <div className="venda-problema-summary">
        <strong>{problemas.length} problema{problemas.length === 1 ? '' : 's'} ativo{problemas.length === 1 ? '' : 's'}</strong>
        <span>Cada problema possui responsaveis, historico e revisao independentes.</span>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {problemas.map(problema => (
        <VendaProblemaCard
          key={problema.id}
          problema={problema}
          usuario={usuario}
          destacado={Number(problema.id) === Number(initialProblemaId)}
          onAtualizar={atualizarProblema}
        />
      ))}
    </div>
  );
}

export default VendaProblemaPanel;
