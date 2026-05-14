import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { listarClientes } from '../../services/cliente.service';
import { listarOperadoras, listarServicos, listarTiposVenda } from '../../services/config.service';
import {
  atualizarVenda,
  aprovarSolicitacaoVenda,
  buscarVendaPorId,
  enviarVendaParaPosVenda,
  listarAprovacoesVenda,
  listarVendedoras,
  recusarSolicitacaoVenda
} from '../../services/venda.service';
import VendaModal from './VendaModal';
import { formatUtcDateTime } from '../../utils/datetime';
import './VendasPage.css';

const STATUS_LABEL = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  obsoleta: 'Obsoleta'
};

const STATUS_CLASS = {
  pendente: 'warn',
  aprovada: 'success',
  recusada: 'danger',
  obsoleta: ''
};

const MOTIVO_LABEL = {
  venda_compartilhada: 'Venda compartilhada',
  cliente_com_venda_existente: 'Cliente com venda existente'
};

function formatarData(valor) {
  return formatUtcDateTime(valor, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }, '-');
}

function nomeVenda(venda) {
  return venda?.cliente?.nome || venda?.nome || venda?.razao_social || `Venda #${venda?.id}`;
}

function nomesVendedoras(venda) {
  const nomes = Array.isArray(venda?.vendedoras) && venda.vendedoras.length > 0
    ? venda.vendedoras.map(item => item.nome).filter(Boolean)
    : [venda?.vendedora?.nome].filter(Boolean);

  return nomes.length > 0 ? nomes.join(', ') : '-';
}

function VendasAprovacoesPage() {
  const [searchParams] = useSearchParams();
  const usuario = getUsuarioLocal();
  const podeDecidir = temPermissao(usuario, 'vendas_aprovacoes_decidir');
  const podeEditarVenda = temPermissao(usuario, ['vendas_editar', 'pos_venda']);
  const podeCompartilharVenda = temPermissao(usuario, 'compartilhar_venda');
  const podeVerDocumentosVenda = temPermissao(usuario, 'vendas_documentos');
  const [status, setStatus] = useState(searchParams.get('status') || 'pendente');
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [tiposVenda, setTiposVenda] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState(null);
  const [recusando, setRecusando] = useState(null);
  const [vendaModal, setVendaModal] = useState(null);
  const [modalModoEdicao, setModalModoEdicao] = useState(false);
  const [carregandoVendaId, setCarregandoVendaId] = useState(null);
  const [solicitacaoModal, setSolicitacaoModal] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const solicitacaoFoco = searchParams.get('solicitacao_id');

  async function carregar() {
    setCarregando(true);
    setErro('');

    try {
      const filtros = status ? { status } : {};
      const dados = await listarAprovacoesVenda(filtros);
      setSolicitacoes(Array.isArray(dados) ? dados : []);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar aprovações.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAuxiliares() {
    try {
      const [clientesData, vendedorasData, operadorasData, tiposVendaData, servicosData] = await Promise.all([
        listarClientes(),
        listarVendedoras(),
        listarOperadoras(),
        listarTiposVenda(),
        listarServicos()
      ]);

      setClientes(clientesData);
      setVendedoras(vendedorasData);
      setOperadoras(operadorasData);
      setTiposVenda(tiposVendaData);
      setServicos(servicosData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar dados do modal de venda.');
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregarAuxiliares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const solicitacoesOrdenadas = useMemo(() => {
    if (!solicitacaoFoco) return solicitacoes;

    return [...solicitacoes].sort((a, b) => {
      if (String(a.id) === String(solicitacaoFoco)) return -1;
      if (String(b.id) === String(solicitacaoFoco)) return 1;
      return 0;
    });
  }, [solicitacoes, solicitacaoFoco]);

  async function aprovar(solicitacao) {
    setSalvandoId(solicitacao.id);
    setErro('');

    try {
      await aprovarSolicitacaoVenda(solicitacao.id);
      setSucesso('Solicitação aprovada. A venda já pode ser enviada ao pós-venda.');
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
      await carregar();
    } catch (error) {
      setErro(error.message || 'Erro ao aprovar solicitação.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function recusar(solicitacao) {
    setSalvandoId(solicitacao.id);
    setErro('');

    try {
      await recusarSolicitacaoVenda(solicitacao.id, { observacao });
      setSucesso('Solicitação recusada.');
      setRecusando(null);
      setObservacao('');
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
      await carregar();
    } catch (error) {
      setErro(error.message || 'Erro ao recusar solicitação.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function abrirVenda(solicitacao) {
    setErro('');
    setCarregandoVendaId(solicitacao.venda_id);

    try {
      const venda = await buscarVendaPorId(solicitacao.venda_id);
      setVendaModal(venda || solicitacao.venda);
      setSolicitacaoModal(solicitacao);
      setModalModoEdicao(false);
    } catch (error) {
      setErro(error.message || 'Erro ao abrir venda.');
    } finally {
      setCarregandoVendaId(null);
    }
  }

  async function salvarVendaModal(dados) {
    if (!vendaModal?.id) return;

    await atualizarVenda(vendaModal.id, dados);
    const atualizada = await buscarVendaPorId(vendaModal.id);
    setVendaModal(atualizada);
    setModalModoEdicao(false);
    setSucesso('Venda atualizada com sucesso.');
    await carregar();
  }

  async function enviarPosVendaModal(venda) {
    const resultado = await enviarVendaParaPosVenda(venda.id);
    const atualizada = await buscarVendaPorId(venda.id);
    setVendaModal(atualizada);
    setModalModoEdicao(false);
    setSucesso(resultado?.status === 'pendente'
      ? (resultado.message || 'Solicitação enviada para aprovação do ADM.')
      : 'Venda enviada para o pós-venda.');
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    await carregar();
  }

  async function aprovarEEnviarPosVendaModal(venda) {
    if (solicitacaoModal?.id) {
      await aprovarSolicitacaoVenda(solicitacaoModal.id);
    }
    await enviarVendaParaPosVenda(venda.id);
    const atualizada = await buscarVendaPorId(venda.id);
    setVendaModal(atualizada);
    setModalModoEdicao(false);
    setSucesso('Venda aprovada e enviada para o pós-venda.');
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    await carregar();
  }

  return (
    <LayoutPrivado>
      <div className="vendas-page">
        <div className="vendas-toolbar">
          <div className="filter-field" style={{ margin: 0, minWidth: 220 }}>
            <label>Status</label>
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option>
              <option value="obsoleta">Obsoletas</option>
            </select>
          </div>

          <button type="button" className="btn" onClick={carregar}>
            <I.Return size={14} /> Atualizar
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          {solicitacoes.length} solicitações encontradas
        </div>

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Venda</th>
                  <th>Motivos</th>
                  <th>Vendedoras</th>
                  <th>Solicitante</th>
                  <th>Status</th>
                  <th>Solicitada em</th>
                  <th>Decisão</th>
                  <th className="aprovacoes-actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando solicitações...
                    </td>
                  </tr>
                ) : solicitacoesOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma solicitação encontrada.
                    </td>
                  </tr>
                ) : solicitacoesOrdenadas.map(solicitacao => (
                  <tr key={solicitacao.id} className={String(solicitacao.id) === String(solicitacaoFoco) ? 'row-highlight' : ''}>
                    <td>
                      <div className="vendas-table-name">
                        <div className="vendas-table-name__title">
                          <strong>{nomeVenda(solicitacao.venda)}</strong>
                        </div>
                        <span>{solicitacao.venda?.cliente?.razao_social || solicitacao.venda?.razao_social || `Venda #${solicitacao.venda_id}`}</span>
                      </div>
                    </td>
                    <td>
                      {(solicitacao.motivos || []).map(motivo => (
                        <span key={motivo} className="tag" style={{ marginRight: 6 }}>
                          {MOTIVO_LABEL[motivo] || motivo}
                        </span>
                      ))}
                    </td>
                    <td>{nomesVendedoras(solicitacao.venda)}</td>
                    <td>{solicitacao.solicitante?.nome || '-'}</td>
                    <td>
                      <span className={`pill ${STATUS_CLASS[solicitacao.status] || ''}`}>
                        <span className="pill-dot"></span>
                        {STATUS_LABEL[solicitacao.status] || solicitacao.status}
                      </span>
                    </td>
                    <td>{formatarData(solicitacao.solicitado_em)}</td>
                    <td>
                      {solicitacao.decisor?.nome ? (
                        <div>
                          <strong style={{ fontSize: 12 }}>{solicitacao.decisor.nome}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>{formatarData(solicitacao.decidido_em)}</div>
                          {solicitacao.observacao_decisao && (
                            <div className="muted" style={{ fontSize: 12 }}>{solicitacao.observacao_decisao}</div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="aprovacoes-actions-col">
                      <div className="aprovacoes-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={carregandoVendaId === solicitacao.venda_id}
                          onClick={() => abrirVenda(solicitacao)}
                        >
                          {carregandoVendaId === solicitacao.venda_id ? 'Abrindo...' : 'Abrir venda'}
                        </button>

                        {podeDecidir && solicitacao.status === 'pendente' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={salvandoId === solicitacao.id}
                              onClick={() => aprovar(solicitacao)}
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={salvandoId === solicitacao.id}
                              onClick={() => {
                                setRecusando(solicitacao);
                                setObservacao('');
                              }}
                            >
                              Recusar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {recusando && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-header-row">
                <div>
                  <div className="modal-client">Recusar solicitação</div>
                  <div className="modal-sub">{nomeVenda(recusando.venda)}</div>
                </div>
                <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={() => setRecusando(null)}>
                  <I.Close size={14} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label>Observação</label>
                <textarea
                  value={observacao}
                  onChange={event => setObservacao(event.target.value)}
                  placeholder="Descreva o motivo da recusa"
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setRecusando(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" disabled={salvandoId === recusando.id} onClick={() => recusar(recusando)}>
                {salvandoId === recusando.id ? 'Recusando...' : 'Recusar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {vendaModal && (
        <VendaModal
          venda={vendaModal}
          initialValues={null}
          clientes={clientes}
          vendas={solicitacoes.map(solicitacao => solicitacao.venda).filter(Boolean)}
          vendedoras={vendedoras}
          operadoras={operadoras}
          tiposVenda={tiposVenda}
          servicos={servicos}
          vendasPorCliente={new Map()}
          podeEditarVenda={podeEditarVenda}
          podeCompartilharVenda={podeCompartilharVenda}
          podeVerDocumentosVenda={podeVerDocumentosVenda}
          usuarioLogado={usuario}
          initialTab="venda"
          initialProblemaId={null}
          modoEdicao={modalModoEdicao}
          onStartEdit={() => setModalModoEdicao(true)}
          onClose={() => {
            setVendaModal(null);
            setSolicitacaoModal(null);
            setModalModoEdicao(false);
          }}
          onSave={salvarVendaModal}
          onSendToPosVenda={podeDecidir && solicitacaoModal?.status === 'pendente' ? aprovarEEnviarPosVendaModal : enviarPosVendaModal}
          sendToPosVendaLabel={podeDecidir && solicitacaoModal?.status === 'pendente' ? 'Aprovar' : 'Enviar para o pós-venda'}
          onCreateClient={() => {}}
        />
      )}
    </LayoutPrivado>
  );
}

export default VendasAprovacoesPage;
