import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import ClienteModal from './ClienteModal';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  importarBaseAnterior,
  listarClientes,
  previewImportacaoBaseAnterior
} from '../../services/cliente.service';
import { listarNotasEntidade } from '../../services/nota.service';
import { listarEtapasFunil, listarOperadoras } from '../../services/config.service';
import { listarVendas } from '../../services/venda.service';
import {
  atualizarCampoLeadRecebido,
  listarMeusLeadEnvios,
  listarMinhasLeadLinhas
} from '../../services/lead-planilha.service';
import './Clientes.css';

function formatarContato(cliente) {
  const whatsapp = [cliente.whatsapp_ddd, cliente.whatsapp_numero].filter(Boolean).join(' ');
  const fixo = [cliente.fixo_ddd, cliente.fixo_numero].filter(Boolean).join(' ');

  return { whatsapp, fixo };
}

function formatarFidelidade(aviso) {
  if (!aviso || aviso.dias_restantes === null || aviso.dias_restantes === undefined) {
    return { label: 'Sem fidelidade', className: '' };
  }

  if (aviso.dias_restantes < 0) {
    return { label: 'Vencida', className: 'danger' };
  }

  if (aviso.deve_avisar) {
    return {
      label: aviso.dias_restantes === 0 ? 'Vence hoje' : `${aviso.dias_restantes} dias`,
      className: 'warn'
    };
  }

  return { label: `${aviso.dias_restantes} dias`, className: 'success' };
}

function formatarMoeda(valor) {
  if (valor === undefined || valor === null || valor === '') return '-';

  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarDataHoraNota(valor) {
  if (!valor) return '';

  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return '';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getRetornoNotaStatus(cliente) {
  const resumo = cliente.notas_resumo || {};

  if (Number(resumo.notas_com_retorno_total || 0) > 0) {
    return {
      className: 'success',
      title: `Retorno marcado para ${formatarDataHoraNota(resumo.proximo_retorno_agendado_para) || 'este cliente'}`
    };
  }

  if (cliente.aviso_fidelidade?.dias_restantes < 0) {
    return {
      className: 'danger',
      title: 'Fidelidade vencida sem retorno marcado'
    };
  }

  return {
    className: 'muted',
    title: 'Sem retorno marcado'
  };
}

function normalizarTextoLead(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getValorLeadRecebido(linha, coluna) {
  if (!coluna) return '';
  if (coluna.atualizada) {
    const colunaBase = getNomeColunaLeadRecebido(linha, coluna.base);
    return colunaBase ? linha.dados_json?.[`${colunaBase} (atualizado)`] ?? '' : '';
  }
  if (typeof coluna === 'string') return linha.dados_json?.[coluna] ?? '';
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return linha.dados_json?.[source?.nome || coluna.nome] ?? '';
}

function getNomeColunaLeadRecebido(linha, coluna) {
  if (!coluna) return '';
  if (typeof coluna === 'string') return coluna;
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return source?.nome || coluna.nome || coluna.label || '';
}

function getLabelColunaLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.label || coluna?.nome || '';
}

function getColunaKeyLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.id || coluna?.nome || coluna?.label || '';
}

function criarColunaAtualizadaLeadRecebido(coluna) {
  const key = getColunaKeyLeadRecebido(coluna);
  const nome = typeof coluna === 'string' ? coluna : coluna?.nome || coluna?.label || '';
  const sources = Array.isArray(coluna?.sources)
    ? coluna.sources.map(source => ({ ...source, nome: `${source.nome} (atualizado)` }))
    : coluna?.sources;

  return {
    ...(typeof coluna === 'string' ? {} : coluna),
    id: `${key}::updated`,
    nome: `${nome} (atualizado)`,
    label: `${getLabelColunaLeadRecebido(coluna)} (atualizado)`,
    sources,
    atualizada: true,
    base: coluna
  };
}

function linhaTemColunaAtualizada(linhas, coluna) {
  return linhas.some(linha => {
    const nome = getNomeColunaLeadRecebido(linha, coluna);
    return nome && Object.prototype.hasOwnProperty.call(linha.dados_json || {}, `${nome} (atualizado)`);
  });
}

function getValorLeadPorNome(linha, nomeColuna) {
  if (!nomeColuna) return '';
  const dados = linha.dados_json || {};
  const nomeAtualizado = `${nomeColuna} (atualizado)`;
  return dados[nomeAtualizado] ?? dados[nomeColuna] ?? '';
}

function getColunasMapeaveisLead(linha, colunas) {
  const opcoes = new Map();

  colunas.forEach(coluna => {
    if (coluna.atualizada) return;
    const nome = getNomeColunaLeadRecebido(linha, coluna);
    if (!nome || opcoes.has(nome)) return;
    opcoes.set(nome, {
      nome,
      label: getLabelColunaLeadRecebido(coluna),
      valor: getValorLeadPorNome(linha, nome)
    });
  });

  if (opcoes.size === 0) {
    Object.keys(linha.dados_json || {})
      .filter(chave => !chave.endsWith(' (atualizado)'))
      .forEach(chave => opcoes.set(chave, {
        nome: chave,
        label: chave,
        valor: getValorLeadPorNome(linha, chave)
      }));
  }

  return Array.from(opcoes.values());
}

function sugerirColunaVenda(campo, opcoes) {
  const aliases = [campo.label, campo.name, ...(campo.aliases || [])].map(normalizarTextoLead);
  const encontrada = opcoes.find(opcao => {
    const label = normalizarTextoLead(opcao.label);
    const nome = normalizarTextoLead(opcao.nome);
    return aliases.some(alias => alias && (label.includes(alias) || nome.includes(alias) || alias.includes(label)));
  });

  return encontrada?.nome || '';
}

function montarVendaPreenchidaDoLead(linha, mapeamento, usuario) {
  const payload = usuario?.id ? { vendedora_id: String(usuario.id) } : {};

  CAMPOS_VENDA_LEAD.forEach(campo => {
    const coluna = mapeamento?.[campo.name];
    const valor = getValorLeadPorNome(linha, coluna);
    if (String(valor || '').trim()) {
      payload[campo.name] = valor;
    }
  });

  return payload;
}

function RegistrarVendaLeadModal({ linha, colunas, usuario, onClose, onConfirm }) {
  const opcoesColunas = useMemo(() => getColunasMapeaveisLead(linha, colunas), [linha, colunas]);
  const [mapeamento, setMapeamento] = useState(() => (
    CAMPOS_VENDA_LEAD.reduce((acc, campo) => ({
      ...acc,
      [campo.name]: sugerirColunaVenda(campo, opcoesColunas)
    }), {})
  ));

  function atualizarMapeamento(campo, valor) {
    setMapeamento(prev => ({ ...prev, [campo]: valor }));
  }

  function submit(event) {
    event.preventDefault();
    onConfirm(montarVendaPreenchidaDoLead(linha, mapeamento, usuario));
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <form className="modal lead-sale-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Registrar venda</div>
              <div className="modal-sub">Escolha quais colunas vão preencher a nova venda.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="lead-sale-map-head">
            <span>Campo da venda</span>
            <span>Coluna da planilha</span>
            <span>Valor que será levado</span>
          </div>

          <div className="lead-sale-map-list">
            {CAMPOS_VENDA_LEAD.map(campo => {
              const coluna = mapeamento[campo.name] || '';
              const valor = getValorLeadPorNome(linha, coluna);

              return (
                <div key={campo.name} className="lead-sale-map-row">
                  <label>{campo.label}</label>
                  <select value={coluna} onChange={event => atualizarMapeamento(campo.name, event.target.value)}>
                    <option value="">Não preencher</option>
                    {opcoesColunas.map(opcao => (
                      <option key={opcao.nome} value={opcao.nome}>{opcao.label}</option>
                    ))}
                  </select>
                  <span title={valor || ''}>{valor || '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Continuar na nova venda</button>
        </div>
      </form>
    </div>
  );
}

function LeadAtualizacaoModal({ dados, salvando, erro, onClose, onSave }) {
  const [valor, setValor] = useState(dados?.valorAtualizado || '');

  if (!dados) return null;

  function submit(event) {
    event.preventDefault();
    onSave(valor);
  }

  return (
    <div className="modal-overlay" onClick={event => !salvando && event.target === event.currentTarget && onClose()}>
      <form className="modal lead-update-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Atualizar informação</div>
              <div className="modal-sub">{dados.label}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="lead-update-summary">
            <span>Informação original</span>
            <strong>{dados.valorOriginal || '-'}</strong>
          </div>

          <div className="form-field">
            <label>Informação atualizada</label>
            <input
              autoFocus
              value={valor}
              onChange={event => setValor(event.target.value)}
              required
            />
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando || !valor.trim()}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeadsRecebidosView() {
  const navigate = useNavigate();
  const [envios, setEnvios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalAtualizacao, setModalAtualizacao] = useState(null);
  const [salvandoAtualizacao, setSalvandoAtualizacao] = useState(false);
  const [erroAtualizacao, setErroAtualizacao] = useState('');
  const [modalVenda, setModalVenda] = useState(null);
  const usuario = useMemo(() => getUsuarioLocal(), []);
  const podeRegistrarVenda = temPermissao(usuario, 'vendas_criar');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarMeusLeadEnvios()
      .then(data => {
        if (!cancelado) setEnvios(data);
      })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (selecionados.length === 0) {
      setLinhas([]);
      setTotalLinhas(0);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarMinhasLeadLinhas({ envio_ids: selecionados, page: pagina, page_size: 200, busca })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotalLinhas(data.total || 0);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [selecionados, pagina, busca]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const enviosSelecionados = useMemo(() => (
    envios.filter(envio => selecionados.includes(envio.id))
  ), [envios, selecionados]);

  const colunas = useMemo(() => {
    const mapa = new Map();

    enviosSelecionados.forEach(envio => {
      (envio.colunas_visiveis || []).forEach(coluna => {
        if (getLabelColunaLeadRecebido(coluna).endsWith(' (atualizado)')) return;
        const key = getColunaKeyLeadRecebido(coluna);
        mapa.set(key, coluna);
      });
    });

    if (mapa.size === 0) {
      linhas.forEach(linha => {
        Object.keys(linha.dados_json || {})
          .filter(coluna => !coluna.endsWith(' (atualizado)'))
          .forEach(coluna => mapa.set(coluna, coluna));
      });
    }

    return Array.from(mapa.values()).flatMap(coluna => (
      linhaTemColunaAtualizada(linhas, coluna)
        ? [coluna, criarColunaAtualizadaLeadRecebido(coluna)]
        : [coluna]
    ));
  }, [enviosSelecionados, linhas]);

  const linhasFiltradas = useMemo(() => {
    return linhas;
  }, [linhas]);

  const totalPaginas = Math.max(1, Math.ceil(totalLinhas / 200));

  function toggleEnvio(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    setPagina(1);
  }

  function abrirAtualizacao(linha, coluna) {
    const nomeColuna = getNomeColunaLeadRecebido(linha, coluna);
    if (!nomeColuna) return;

    setErroAtualizacao('');
    setModalAtualizacao({
      linhaId: linha.id,
      coluna: nomeColuna,
      label: getLabelColunaLeadRecebido(coluna),
      valorOriginal: getValorLeadRecebido(linha, coluna),
      valorAtualizado: linha.dados_json?.[`${nomeColuna} (atualizado)`] || ''
    });
  }

  async function salvarAtualizacao(valor) {
    if (!modalAtualizacao || !valor.trim()) {
      setErroAtualizacao('Informe a informação atualizada.');
      return;
    }

    setSalvandoAtualizacao(true);
    setErroAtualizacao('');
    setErro('');
    setSucesso('');

    try {
      const resultado = await atualizarCampoLeadRecebido(modalAtualizacao.linhaId, {
        coluna: modalAtualizacao.coluna,
        valor
      });

      setLinhas(prev => prev.map(linha => (
        linha.id === resultado.linha?.id ? resultado.linha : linha
      )));
      setModalAtualizacao(null);
      setSucesso('Informação atualizada salva.');
    } catch (error) {
      setErroAtualizacao(error.message || 'Erro ao atualizar lead recebido.');
    } finally {
      setSalvandoAtualizacao(false);
    }
  }

  function abrirRegistroVenda(linha) {
    setModalVenda(linha);
  }

  function continuarRegistroVenda(vendaPreenchida) {
    navigate('/vendas?nova=1', {
      state: {
        vendaPreenchida,
        origemLead: {
          linha_id: modalVenda?.id,
          envio: modalVenda?.envio?.nome || ''
        }
      }
    });
  }

  return (
    <div className="clientes-leads-view">
      {modalAtualizacao && (
        <LeadAtualizacaoModal
          key={`${modalAtualizacao.linhaId}:${modalAtualizacao.coluna}`}
          dados={modalAtualizacao}
          salvando={salvandoAtualizacao}
          erro={erroAtualizacao}
          onClose={() => {
            if (salvandoAtualizacao) return;
            setModalAtualizacao(null);
            setErroAtualizacao('');
          }}
          onSave={salvarAtualizacao}
        />
      )}

      {modalVenda && (
        <RegistrarVendaLeadModal
          linha={modalVenda}
          colunas={colunas}
          usuario={usuario}
          onClose={() => setModalVenda(null)}
          onConfirm={continuarRegistroVenda}
        />
      )}

      <div className="clientes-leads-strip">
        <div className="clientes-leads-strip__title">Planilhas recebidas</div>
        <div className="clientes-leads-docs">
          {envios.map(envio => (
            <button
              key={envio.id}
              type="button"
              className={`clientes-leads-doc ${selecionados.includes(envio.id) ? 'active' : ''}`}
              onClick={() => toggleEnvio(envio.id)}
            >
              <div className="clientes-leads-preview">
                <span></span><span></span><span></span><span></span>
              </div>
              <strong title={envio.nome}>{envio.nome}</strong>
              <small>{new Date(envio.created_at).toLocaleDateString('pt-BR')} - {envio.total_linhas} leads</small>
            </button>
          ))}
          {!carregando && envios.length === 0 && (
            <div className="lead-doc-empty">Nenhum envio recebido.</div>
          )}
        </div>
      </div>

      <div className="clientes-leads-toolbar">
        <div className="clientes-toolbar__meta">
          {totalLinhas} lead(s) recebidos
        </div>
        <div className="clientes-leads-actions">
          <form className="clientes-search" onSubmit={event => event.preventDefault()}>
            <I.Search size={14} />
            <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar nos leads recebidos" />
          </form>
        </div>
      </div>

      {sucesso && <div className="alert-success alert-timed alert-timed--success">{sucesso}</div>}
      {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

      <div className="list-table clientes-leads-table" style={{ margin: 0 }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Envio</th>
                <th>Registrar venda</th>
                {colunas.map(coluna => <th key={getColunaKeyLeadRecebido(coluna)}>{getLabelColunaLeadRecebido(coluna)}</th>)}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Carregando leads...</td></tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Selecione uma planilha recebida.</td></tr>
              ) : (
                linhasFiltradas.map(linha => (
                  <tr key={linha.id}>
                    <td><span className="tag">{linha.envio?.nome || '-'}</span></td>
                    <td>
                      {podeRegistrarVenda ? (
                        <button type="button" className="lead-register-sale-btn" onClick={() => abrirRegistroVenda(linha)}>
                          Registrar venda
                        </button>
                      ) : '-'}
                    </td>
                    {colunas.map(coluna => {
                      const valor = getValorLeadRecebido(linha, coluna);
                      const key = getColunaKeyLeadRecebido(coluna);
                      const podeAtualizar = !coluna.atualizada && Boolean(getNomeColunaLeadRecebido(linha, coluna));

                      return (
                        <td key={key} className={coluna.atualizada ? 'lead-updated-cell' : ''}>
                          {coluna.atualizada || !podeAtualizar ? (
                            valor || '-'
                          ) : (
                            <button
                              type="button"
                              className="lead-cell-button"
                              onClick={() => abrirAtualizacao(linha, coluna)}
                              title="Atualizar informação"
                            >
                              {valor || '-'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lead-pagination">
        <button className="btn" type="button" disabled={pagina <= 1} onClick={() => setPagina(prev => Math.max(1, prev - 1))}>Anterior</button>
        <span>Página {pagina} de {totalPaginas}</span>
        <button className="btn" type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(prev => Math.min(totalPaginas, prev + 1))}>Próxima</button>
      </div>
    </div>
  );
}

function ConfirmarLixeiraModal({ cliente, excluindo, onClose, onConfirm }) {
  if (!cliente) return null;

  return (
    <div className="modal-overlay" onClick={event => !excluindo && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Enviar cliente para a lixeira?</div>
              <div className="modal-sub">{cliente.nome} - #{cliente.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={excluindo}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="trash-warning">
            <I.AlertTriangle size={20} />
            <div>
              <strong>Este cliente será enviado para a lixeira.</strong>
              <span>Ele ficará disponível para restauração e será permanentemente deletado daqui a 1 mês.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={excluindo}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={excluindo}>
            {excluindo ? 'Enviando...' : 'Enviar para lixeira'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotasClienteReadOnlyModal({ cliente, notas, carregando, erro, onClose }) {
  if (!cliente) return null;

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal cliente-notes-readonly-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Notas do cliente</div>
              <div className="modal-sub">{cliente.nome || cliente.razao_social || `Cliente #${cliente.id}`}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {erro && <div className="alert-error">{erro}</div>}

          {carregando ? (
            <div className="notes-loading">Carregando notas...</div>
          ) : notas.length === 0 ? (
            <div className="notes-empty notes-empty--compact">
              <I.Note size={20} />
              <strong>Nenhuma nota ainda.</strong>
              <span>Este cliente ainda não tem anotações.</span>
            </div>
          ) : (
            <div className="cliente-notes-readonly-list">
              {notas.map(nota => (
                <article key={nota.id} className="cliente-note-readonly-card">
                  <div className="cliente-note-readonly-card__head">
                    <strong>{nota.titulo || 'Sem titulo'}</strong>
                    <span>{formatarDataHoraNota(nota.updated_at)}</span>
                  </div>
                  <p>{nota.conteudo || '-'}</p>
                  {nota.retorno_agendado_para && (
                    <div className="cliente-note-readonly-card__return">
                      <I.Calendar size={13} /> Retorno em {formatarDataHoraNota(nota.retorno_agendado_para)}
                    </div>
                  )}
                </article>
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

const CAMPOS_IMPORTACAO_BASE = [
  { name: 'cnpj', label: 'CNPJ', required: true },
  { name: 'nome', label: 'Nome' },
  { name: 'razao_social', label: 'Razao social' },
  { name: 'responsavel_nome', label: 'Responsavel' },
  { name: 'email', label: 'E-mail' },
  { name: 'whatsapp', label: 'WhatsApp' },
  { name: 'fixo', label: 'Fixo' },
  { name: 'quantidade_chips', label: 'Quantidade de chips' },
  { name: 'valor_pago', label: 'Valor pago' },
  { name: 'operadora_atual', label: 'Operadora atual' }
];

function ImportarBaseAnteriorModal({ onClose, onImported }) {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const colunas = preview?.colunas || [];
  const podeImportar = Boolean(arquivo && preview && mapeamento.cnpj && !carregando);

  async function carregarPreview(file) {
    setArquivo(file || null);
    setPreview(null);
    setResultado(null);
    setMapeamento({});
    setErro('');

    if (!file) return;

    setCarregando(true);
    try {
      const data = await previewImportacaoBaseAnterior(file);
      setPreview(data);
      setMapeamento(data.sugestoes || {});
    } catch (error) {
      setErro(error.message || 'Erro ao ler planilha.');
    } finally {
      setCarregando(false);
    }
  }

  async function executarImportacao(event) {
    event.preventDefault();
    if (!podeImportar) return;

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const data = await importarBaseAnterior(arquivo, mapeamento);
      setResultado(data);
      await onImported(data);
    } catch (error) {
      setErro(error.message || 'Erro ao importar planilha.');
    } finally {
      setCarregando(false);
    }
  }

  function atualizarMapeamento(campo, coluna) {
    setMapeamento(prev => ({ ...prev, [campo]: coluna }));
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && !carregando && onClose()}>
      <form className="modal cliente-import-modal" onSubmit={executarImportacao}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Importar base anterior</div>
              <div className="modal-sub">Selecione o Excel e relacione cada coluna aos campos do cliente.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={carregando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label>Arquivo .xlsx</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={event => carregarPreview(event.target.files?.[0])}
              disabled={carregando}
            />
          </div>

          {preview && (
            <>
              <div className="cliente-import-summary">
                <span>Aba: <strong>{preview.aba}</strong></span>
                <span>Linhas: <strong>{preview.total_linhas}</strong></span>
                <span>Colunas: <strong>{colunas.length}</strong></span>
              </div>

              <div className="cliente-import-map">
                <div className="cliente-import-map__head">
                  <span>Campo do cliente</span>
                  <span>Coluna do Excel</span>
                  <span>Amostras</span>
                </div>
                {CAMPOS_IMPORTACAO_BASE.map(campo => {
                  const colunaSelecionada = mapeamento[campo.name] || '';
                  const amostras = (preview.amostras || [])
                    .map(item => item.dados?.[colunaSelecionada])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(' | ');

                  return (
                    <div className="cliente-import-map__row" key={campo.name}>
                      <label>
                        {campo.label}
                        {campo.required && <span className="required-mark">*</span>}
                      </label>
                      <select
                        value={colunaSelecionada}
                        onChange={event => atualizarMapeamento(campo.name, event.target.value)}
                        required={campo.required}
                        disabled={carregando}
                      >
                        <option value="">Nao importar</option>
                        {colunas.map(coluna => (
                          <option key={`${campo.name}:${coluna.index}`} value={coluna.nome}>{coluna.nome}</option>
                        ))}
                      </select>
                      <span title={amostras}>{amostras || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {resultado && (
            <div className="cliente-import-result">
              <span>Linhas lidas: <strong>{resultado.linhas_lidas}</strong></span>
              <span>CNPJs unicos: <strong>{resultado.cnpjs_unicos}</strong></span>
              <span>Criados: <strong>{resultado.criados}</strong></span>
              <span>Atualizados: <strong>{resultado.atualizados}</strong></span>
              <span>Ignorados: <strong>{resultado.linhas_ignoradas}</strong></span>
              {resultado.operadoras_nao_encontradas?.length > 0 && (
                <span>Operadoras nao encontradas: <strong>{resultado.operadoras_nao_encontradas.join(', ')}</strong></span>
              )}
              {resultado.erros?.length > 0 && (
                <span>Erros: <strong>{resultado.erros.slice(0, 3).map(item => `linha ${item.row_index}`).join(', ')}</strong></span>
              )}
            </div>
          )}

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={carregando}>Fechar</button>
          <button type="submit" className="btn btn-primary" disabled={!podeImportar}>
            {carregando ? 'Processando...' : 'Importar clientes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Clientes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const usuario = getUsuarioLocal();
  const clienteIdParam = searchParams.get('cliente_id') || '';
  const fidelidadeParam = searchParams.get('fidelidade') || '';
  const retornoParam = searchParams.get('retorno') || '';
  const novoClienteParam = searchParams.get('novo') === '1';
  const highlightClienteId = searchParams.get('highlight') || clienteIdParam;

  const podeCriar = temPermissao(usuario, 'clientes_criar');
  const podeEditar = temPermissao(usuario, 'clientes_editar');
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');

  const [clientes, setClientes] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [etapasFunil, setEtapasFunil] = useState([]);
  const [busca, setBusca] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [responsavelTipo, setResponsavelTipo] = useState('');
  const [fidelidade, setFidelidade] = useState(fidelidadeParam);
  const [retorno, setRetorno] = useState(retornoParam);
  const [baseAnterior, setBaseAnterior] = useState('');
  const [chipsMin, setChipsMin] = useState('');
  const [chipsMax, setChipsMax] = useState('');
  const [clienteIdFiltro, setClienteIdFiltro] = useState(clienteIdParam);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [clienteModal, setClienteModal] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [importModalAberto, setImportModalAberto] = useState(false);
  const [clienteParaLixeira, setClienteParaLixeira] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('clientes');
  const [clienteNotasModal, setClienteNotasModal] = useState(null);
  const [notasCliente, setNotasCliente] = useState([]);
  const [carregandoNotasCliente, setCarregandoNotasCliente] = useState(false);
  const [erroNotasCliente, setErroNotasCliente] = useState('');

  const filtros = useMemo(() => ({
    busca,
    operadora_atual_id: operadoraId,
    responsavel_tipo: responsavelTipo,
    fidelidade,
    retorno,
    base_anterior_sistema: baseAnterior,
    chips_min: chipsMin,
    chips_max: chipsMax,
    cliente_id: clienteIdFiltro
  }), [busca, operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax, clienteIdFiltro]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = useMemo(() => (
    [operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax]
      .filter(v => v !== '').length
  ), [operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  async function carregarClientes(proximosFiltros = filtros) {
    setErro('');
    setCarregando(true);

    try {
      const [dados, operadorasData, vendasData, etapasData] = await Promise.all([
        listarClientes(proximosFiltros),
        listarOperadoras(),
        listarVendas(),
        listarEtapasFunil(),
      ]);
      setClientes(dados);
      setOperadoras(operadorasData);
      setVendas(vendasData);
      setEtapasFunil(etapasData || []);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    setClienteIdFiltro(clienteIdParam);
    if (clienteIdParam) {
      setAbaAtiva('clientes');
    }
  }, [clienteIdParam]);

  useEffect(() => {
    setFidelidade(fidelidadeParam);
    if (fidelidadeParam) {
      setAbaAtiva('clientes');
    }
  }, [fidelidadeParam]);

  useEffect(() => {
    setRetorno(retornoParam);
    if (retornoParam) {
      setAbaAtiva('clientes');
    }
  }, [retornoParam]);

  useEffect(() => {
    if (!novoClienteParam) return;

    setAbaAtiva('clientes');

    if (podeCriar) {
      setClienteModal(null);
      setModalAberto(true);
    } else {
      setErro('Você não tem permissão para cadastrar clientes.');
    }

    const proximosParams = new URLSearchParams(searchParams);
    proximosParams.delete('novo');
    setSearchParams(proximosParams, { replace: true });
  }, [novoClienteParam, podeCriar, searchParams, setSearchParams]);

  useEffect(() => {
    carregarClientes();
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const clientesComAviso = useMemo(() => (
    clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar).length
  ), [clientes]);

  const vendasConcluidasPorCliente = useMemo(() => {
    const codigosFinais = new Set(etapasFunil.filter(e => e.etapa_final).map(e => e.codigo));
    return vendas
      .filter(v => codigosFinais.has(v.status_funil))
      .reduce((acc, v) => {
        if (!v.cliente_id) return acc;
        const chave = `cliente:${v.cliente_id}`;
        acc.set(chave, (acc.get(chave) || 0) + 1);
        return acc;
      }, new Map());
  }, [vendas, etapasFunil]);

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes(filtros);
  }

  function limparFiltros() {
    setBusca('');
    setOperadoraId('');
    setResponsavelTipo('');
    setFidelidade('');
    setRetorno('');
    setBaseAnterior('');
    setChipsMin('');
    setChipsMax('');
    setClienteIdFiltro('');
  }

  function abrirNovoCliente() {
    setClienteModal(null);
    setModalAberto(true);
  }

  function abrirEdicaoCliente(cliente) {
    if (!podeEditar) return;
    setClienteModal(cliente);
    setModalAberto(true);
  }

  async function salvarCliente(dados) {
    setErro('');
    const editando = Boolean(clienteModal);

    if (clienteModal) {
      await atualizarCliente(clienteModal.id, dados);
    } else {
      await criarCliente(dados);
    }

    setModalAberto(false);
    setClienteModal(null);
    await carregarClientes(filtros);
    setSucesso(editando ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
  }

  async function finalizarImportacaoBaseAnterior(resultado) {
    await carregarClientes(filtros);
    setSucesso(`Importacao concluida: ${resultado.criados || 0} criado(s) e ${resultado.atualizados || 0} atualizado(s).`);
  }

  async function confirmarExclusaoCliente() {
    if (!clienteParaLixeira) return;

    setExcluindo(true);
    try {
      await excluirCliente(clienteParaLixeira.id);
      setClientes(prev => prev.filter(item => item.id !== clienteParaLixeira.id));
      setClienteParaLixeira(null);
      setSucesso('Cliente enviado para a lixeira.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir cliente.');
    } finally {
      setExcluindo(false);
    }
  }

  async function abrirNotasCliente(cliente) {
    setClienteNotasModal(cliente);
    setNotasCliente([]);
    setErroNotasCliente('');
    setCarregandoNotasCliente(true);

    try {
      const notas = await listarNotasEntidade('cliente', cliente.id);
      setNotasCliente(Array.isArray(notas) ? notas : []);
    } catch (error) {
      setErroNotasCliente(error.message || 'Erro ao carregar notas.');
    } finally {
      setCarregandoNotasCliente(false);
    }
  }

  return (
    <LayoutPrivado>
      {modalAberto && (
        <ClienteModal
          cliente={clienteModal}
          operadoras={operadoras}
          onClose={() => setModalAberto(false)}
          onSave={salvarCliente}
        />
      )}

      {importModalAberto && (
        <ImportarBaseAnteriorModal
          onClose={() => setImportModalAberto(false)}
          onImported={finalizarImportacaoBaseAnterior}
        />
      )}

      <ConfirmarLixeiraModal
        cliente={clienteParaLixeira}
        excluindo={excluindo}
        onClose={() => setClienteParaLixeira(null)}
        onConfirm={confirmarExclusaoCliente}
      />

      <NotasClienteReadOnlyModal
        cliente={clienteNotasModal}
        notas={notasCliente}
        carregando={carregandoNotasCliente}
        erro={erroNotasCliente}
        onClose={() => {
          setClienteNotasModal(null);
          setNotasCliente([]);
          setErroNotasCliente('');
        }}
      />

      {filtrosAbertos && (
        <div className="filtros-popup-overlay" onClick={() => setFiltrosAbertos(false)}>
          <div className="filtros-popup" onClick={e => e.stopPropagation()}>
            <div className="filtros-popup__header">
              <span>Filtros</span>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setFiltrosAbertos(false)}>
                <I.Close size={14} />
              </button>
            </div>
            <div className="filtros-popup__body">
              <div className="filter-field">
                <label>Operadora</label>
                <select value={operadoraId} onChange={e => setOperadoraId(e.target.value)}>
                  <option value="">Todas</option>
                  {operadoras.map(operadora => (
                    <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Responsavel</label>
                <select value={responsavelTipo} onChange={e => setResponsavelTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="rl">RL</option>
                  <option value="adm">ADM</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Fidelidade</label>
                <select value={fidelidade} onChange={e => setFidelidade(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="ativa">Ativa</option>
                  <option value="alerta">Com alerta</option>
                  <option value="vencida">Vencida</option>
                  <option value="sem">Sem fidelidade</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Base anterior</label>
                <select value={baseAnterior} onChange={e => setBaseAnterior(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="true">Somente base anterior</option>
                  <option value="false">Sem marcador</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Chips min.</label>
                <input type="number" min="0" value={chipsMin} onChange={e => setChipsMin(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>Chips max.</label>
                <input type="number" min="0" value={chipsMax} onChange={e => setChipsMax(e.target.value)} />
              </div>
            </div>
            <div className="filtros-popup__footer">
              <button type="button" className="btn btn-ghost" onClick={limparFiltros} disabled={filtrosPopupAtivos === 0}>
                <I.Close size={13} /> Limpar filtros
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFiltrosAbertos(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="clientes-page">
        <div className="clientes-tabs">
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'clientes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('clientes')}
          >
            Clientes cadastrados
          </button>
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'leads' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('leads')}
          >
            Leads recebidos
          </button>
        </div>

        {abaAtiva === 'leads' ? (
          <LeadsRecebidosView />
        ) : (
          <>
        <div className="clientes-toolbar">
          <div className="clientes-toolbar__meta">
            {clientes.length} clientes cadastrados
            {clientesComAviso > 0 ? ` - ${clientesComAviso} aviso(s) de fidelidade` : ''}
            {filtrosAtivos > 0 ? ` - ${filtrosAtivos} filtro(s) ativo(s)` : ''}
          </div>

          <div className="clientes-toolbar__actions">
            <form className="clientes-search" onSubmit={handleBuscar}>
              <I.Search size={14} />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder="Buscar por nome, CNPJ, e-mail..."
              />
            </form>

            <button className="btn" type="button" onClick={() => setFiltrosAbertos(true)}>
              <I.Filter size={14} /> Filtros
              {filtrosPopupAtivos > 0 && <span className="filtros-count">{filtrosPopupAtivos}</span>}
            </button>

            {podeCriar && (
              <>
                <button className="btn" type="button" onClick={() => setImportModalAberto(true)}>
                  <I.TableSheet size={14} /> Importar base
                </button>
                <button className="btn btn-primary" onClick={abrirNovoCliente}>
                  <I.Plus size={14} /> Novo cliente
                </button>
              </>
            )}

            {podeExcluir && (
              <button className="btn btn-danger" onClick={() => navigate('/clientes/lixeira')}>
                <I.Trash size={14} /> Lixeira
              </button>
            )}
          </div>
        </div>

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsavel</th>
                  <th>Contato</th>
                  <th>Operadora</th>
                  <th>Registrado por</th>
                  <th>Valor pago</th>
                  <th>Chips</th>
                  <th>Fidelidade</th>
                  <th>Retorno</th>
                  {podeExcluir && <th>Excluir</th>}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeExcluir ? 10 : 9} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={podeExcluir ? 10 : 9} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => {
                    const contato = formatarContato(cliente);
                    const fidelidade = formatarFidelidade(cliente.aviso_fidelidade);
                    const retornoNota = getRetornoNotaStatus(cliente);

                    return (
                      <tr
                        key={cliente.id}
                        className={[
                          podeEditar ? 'clickable-row' : '',
                          String(cliente.id) === String(highlightClienteId) ? 'cliente-row-highlight' : '',
                          fidelidade === 'vencida' && cliente.aviso_fidelidade?.dias_restantes < 0 ? 'cliente-row-fidelity-expired' : ''
                        ].filter(Boolean).join(' ')}
                        role={podeEditar ? 'button' : undefined}
                        tabIndex={podeEditar ? 0 : undefined}
                        onClick={() => abrirEdicaoCliente(cliente)}
                        onKeyDown={(event) => {
                          if (!podeEditar) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            abrirEdicaoCliente(cliente);
                          }
                        }}
                      >
                        <td>
                          <div className="cliente-primary">
                            <div className="cliente-primary__title">
                              <strong>{cliente.nome}</strong>
                              {cliente.base_anterior_sistema ? (
                                <span className="tag clientes-base-tag">Base anterior</span>
                              ) : null}
                              {(() => {
                                const n = vendasConcluidasPorCliente.get(`cliente:${cliente.id}`) || 0;
                                if (!n) return null;
                                return (
                                  <span className="clientes-concluidas-badge">
                                    <I.Check size={11} />
                                    {n} {n === 1 ? 'venda concluída' : 'vendas concluídas'}
                                  </span>
                                );
                              })()}
                            </div>
                            <span>{cliente.razao_social || 'Sem razão social'} - {cliente.cnpj || 'Sem CNPJ'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tag">{cliente.responsavel_tipo === 'adm' ? 'ADM' : 'RL'}</span>{' '}
                          {cliente.responsavel_nome || '-'}
                        </td>
                        <td>
                          <div className="cliente-contact">
                            <span>{cliente.email || '-'}</span>
                            <span>{contato.whatsapp || contato.fixo || '-'}</span>
                          </div>
                        </td>
                        <td>{cliente.operadoraAtual?.nome || '-'}</td>
                        <td>
                          <span className="tag">{cliente.criador?.nome || 'Sem registro'}</span>
                        </td>
                        <td>{formatarMoeda(cliente.valor_pago)}</td>
                        <td>{cliente.quantidade_chips ?? '-'}</td>
                        <td>
                          <span className={`pill ${fidelidade.className}`}>
                            <span className="pill-dot"></span>
                            {fidelidade.label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`cliente-note-status-btn ${retornoNota.className}`}
                            title={retornoNota.title}
                            onClick={(event) => {
                              event.stopPropagation();
                              abrirNotasCliente(cliente);
                            }}
                          >
                            <I.Note size={13} />
                            Nota
                          </button>
                        </td>
                        {podeExcluir && (
                          <td>
                            <div className="clientes-actions">
                              <button
                                className="btn btn-icon btn-ghost btn-danger-icon"
                                title="Excluir"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setClienteParaLixeira(cliente);
                                }}
                              >
                                <I.Trash size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default Clientes;
