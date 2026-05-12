import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarCampoLeadRecebido,
  listarFuturosClientesLeads,
  listarMeusLeadEnvios,
  listarMinhasLeadLinhas,
  marcarFuturoClienteLead
} from '../../services/lead-planilha.service';
import './FuturosClientesPage.css';

// ─── Helpers de colunas de lead ──────────────────────────────────────────────

function normalizarTextoLead(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

const CAMPOS_VENDA_LEAD = [
  { name: 'nome', label: 'Nome', aliases: ['nome', 'name', 'cliente', 'empresa'] },
  { name: 'razao_social', label: 'Razão Social', aliases: ['razao', 'razao social', 'razão social', 'empresa'] },
  { name: 'cnpj', label: 'CNPJ', aliases: ['cnpj', 'cpf', 'documento'] },
  { name: 'telefone', label: 'Celular / Telefone', aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'] },
  { name: 'email', label: 'E-mail', aliases: ['email', 'e-mail', 'correio'] },
  { name: 'responsavel_nome', label: 'Responsável', aliases: ['responsavel', 'responsável', 'contato', 'rep'] }
];

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

function formatarDataHora(valor) {
  if (!valor) return '-';
  const d = new Date(String(valor).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Modal: registrar venda ───────────────────────────────────────────────────

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

// ─── Modal: atualizar campo ───────────────────────────────────────────────────

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

// ─── Modal: adicionar lead (popup intermediário) ──────────────────────────────

function AdicionarLeadModal({ linha, colunas, usuario, onClose, onRegistrarVenda, onFuturoClienteSalvo }) {
  const [etapa, setEtapa] = useState('opcoes'); // 'opcoes' | 'venda' | 'futuro'
  const [notas, setNotas] = useState('');
  const [retorno, setRetorno] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const camposLead = useMemo(() => {
    const dados = linha.dados_json || {};
    return Object.entries(dados)
      .filter(([chave]) => !chave.endsWith(' (atualizado)'))
      .map(([chave, valor]) => ({
        label: chave,
        valor: dados[`${chave} (atualizado)`] ?? valor
      }));
  }, [linha]);

  async function salvarFuturoCliente(event) {
    event.preventDefault();
    setSalvando(true);
    setErro('');

    try {
      const resultado = await marcarFuturoClienteLead(linha.id, { notas, retorno: retorno || null });
      onFuturoClienteSalvo(resultado.linha);
    } catch (error) {
      setErro(error.message || 'Erro ao registrar futuro cliente.');
      setSalvando(false);
    }
  }

  if (etapa === 'venda') {
    return (
      <RegistrarVendaLeadModal
        linha={linha}
        colunas={colunas}
        usuario={usuario}
        onClose={onClose}
        onConfirm={onRegistrarVenda}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={event => !salvando && event.target === event.currentTarget && onClose()}>
      <div className="modal adicionar-lead-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Adicionar lead</div>
              <div className="modal-sub">{linha.envio?.nome || 'Lead recebido'}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="adicionar-lead-dados">
            {camposLead.map(({ label, valor }) => (
              <div key={label} className="adicionar-lead-campo">
                <span className="adicionar-lead-campo__label">{label}</span>
                <span className="adicionar-lead-campo__valor">{valor || '-'}</span>
              </div>
            ))}
            {camposLead.length === 0 && (
              <div className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis.</div>
            )}
          </div>

          {etapa === 'opcoes' && (
            <div className="adicionar-lead-acoes">
              <button type="button" className="btn btn-primary" onClick={() => setEtapa('venda')}>
                <I.Chart size={14} /> Registrar venda
              </button>
              <button type="button" className="btn" onClick={() => setEtapa('futuro')}>
                <I.Calendar size={14} /> Registrar futuro cliente
              </button>
            </div>
          )}

          {etapa === 'futuro' && (
            <form className="futuro-cliente-form" onSubmit={salvarFuturoCliente}>
              <div className="form-field">
                <label>Notas sobre este cliente</label>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={event => setNotas(event.target.value)}
                  placeholder="Observações, interesses, histórico..."
                  disabled={salvando}
                />
              </div>
              <div className="form-field">
                <label>Data de retorno</label>
                <input
                  type="datetime-local"
                  value={retorno}
                  onChange={event => setRetorno(event.target.value)}
                  disabled={salvando}
                />
              </div>

              {erro && <div className="alert-error" style={{ marginTop: 8 }}>{erro}</div>}

              <div className="futuro-cliente-form__actions">
                <button type="button" className="btn" onClick={() => { setEtapa('opcoes'); setErro(''); }} disabled={salvando}>
                  Voltar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar futuro cliente'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Aba: leads recebidos ─────────────────────────────────────────────────────

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
  const [modalAdicionar, setModalAdicionar] = useState(null);
  const usuario = useMemo(() => getUsuarioLocal(), []);
  const podeRegistrarVenda = temPermissao(usuario, 'vendas_criar');
  const podeRegistrarFuturo = temPermissao(usuario, 'futuros_clientes_registrar');

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarMeusLeadEnvios()
      .then(data => { if (!cancelado) setEnvios(data); })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
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
    return () => { cancelado = true; };
  }, [selecionados, pagina, busca]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const enviosSelecionados = useMemo(
    () => envios.filter(envio => selecionados.includes(envio.id)),
    [envios, selecionados]
  );

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

  function continuarRegistroVenda(vendaPreenchida) {
    navigate('/vendas?nova=1', {
      state: {
        vendaPreenchida,
        origemLead: {
          linha_id: modalAdicionar?.id,
          envio: modalAdicionar?.envio?.nome || ''
        }
      }
    });
  }

  function handleFuturoClienteSalvo(linhaAtualizada) {
    setLinhas(prev => prev.map(l => l.id === linhaAtualizada.id ? linhaAtualizada : l));
    setModalAdicionar(null);
    setSucesso('Lead marcado como futuro cliente com sucesso.');
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

      {modalAdicionar && (
        <AdicionarLeadModal
          linha={modalAdicionar}
          colunas={colunas}
          usuario={usuario}
          onClose={() => setModalAdicionar(null)}
          onRegistrarVenda={continuarRegistroVenda}
          onFuturoClienteSalvo={handleFuturoClienteSalvo}
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
                {(podeRegistrarVenda || podeRegistrarFuturo) && <th>Adicionar</th>}
                {colunas.map(coluna => <th key={getColunaKeyLeadRecebido(coluna)}>{getLabelColunaLeadRecebido(coluna)}</th>)}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Carregando leads...</td></tr>
              ) : linhas.length === 0 ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Selecione uma planilha recebida.</td></tr>
              ) : (
                linhas.map(linha => (
                  <tr key={linha.id} className={linha.futuro_cliente ? 'lead-row-futuro' : ''}>
                    <td><span className="tag">{linha.envio?.nome || '-'}</span></td>
                    {(podeRegistrarVenda || podeRegistrarFuturo) && (
                      <td>
                        <button
                          type="button"
                          className="lead-register-sale-btn"
                          onClick={() => setModalAdicionar(linha)}
                        >
                          {linha.futuro_cliente ? 'Futuro cliente' : 'Adicionar'}
                        </button>
                      </td>
                    )}
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

// ─── Aba: futuros clientes ────────────────────────────────────────────────────

function FuturosClientesMainView() {
  const [linhas, setLinhas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarFuturosClientesLeads({ page: pagina, page_size: 50, busca })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotal(data.total || 0);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar futuros clientes.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, [pagina, busca]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const colunasDados = useMemo(() => {
    const mapa = new Map();
    linhas.forEach(linha => {
      Object.keys(linha.dados_json || {})
        .filter(chave => !chave.endsWith(' (atualizado)'))
        .forEach(chave => mapa.set(chave, chave));
    });
    return Array.from(mapa.keys());
  }, [linhas]);

  const totalPaginas = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="futuros-clientes-view">
      <div className="clientes-leads-toolbar">
        <div className="clientes-toolbar__meta">{total} futuro(s) cliente(s)</div>
        <div className="clientes-leads-actions">
          <form className="clientes-search" onSubmit={event => event.preventDefault()}>
            <I.Search size={14} />
            <input
              value={busca}
              onChange={event => { setBusca(event.target.value); setPagina(1); }}
              placeholder="Buscar futuros clientes..."
            />
          </form>
        </div>
      </div>

      {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

      <div className="list-table futuros-clientes-table" style={{ margin: 0 }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Envio</th>
                <th>Notas</th>
                <th>Retorno</th>
                <th>Marcado em</th>
                {colunasDados.map(chave => <th key={chave}>{chave}</th>)}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={colunasDados.length + 4} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    Carregando futuros clientes...
                  </td>
                </tr>
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={colunasDados.length + 4} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    Nenhum futuro cliente cadastrado.
                  </td>
                </tr>
              ) : (
                linhas.map(linha => {
                  const dados = linha.dados_json || {};
                  return (
                    <tr key={linha.id}>
                      <td><span className="tag">{linha.envio?.nome || '-'}</span></td>
                      <td>
                        <span
                          className={`futuro-cliente-notas-cell ${linha.futuro_cliente_notas ? '' : 'muted'}`}
                          title={linha.futuro_cliente_notas || ''}
                        >
                          {linha.futuro_cliente_notas || '-'}
                        </span>
                      </td>
                      <td>
                        {linha.futuro_cliente_retorno ? (
                          <span className="pill success">
                            <span className="pill-dot"></span>
                            {formatarDataHora(linha.futuro_cliente_retorno)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>{formatarDataHora(linha.futuro_cliente_marcado_em)}</td>
                      {colunasDados.map(chave => {
                        const valor = dados[`${chave} (atualizado)`] ?? dados[chave] ?? '';
                        return <td key={chave}>{valor || '-'}</td>;
                      })}
                    </tr>
                  );
                })
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

// ─── Página principal ─────────────────────────────────────────────────────────

function FuturosClientesPage() {
  const [abaAtiva, setAbaAtiva] = useState('futuros');

  return (
    <LayoutPrivado>
      <div className="futuros-clientes-page">
        <div className="clientes-tabs">
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'futuros' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('futuros')}
          >
            Futuros clientes
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
          <FuturosClientesMainView />
        )}
      </div>
    </LayoutPrivado>
  );
}

export default FuturosClientesPage;
