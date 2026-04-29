import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { atualizarCliente, criarCliente, excluirCliente, listarClientes } from '../../services/cliente.service';
import { listarOperadoras } from '../../services/config.service';
import './Clientes.css';

const FORM_INICIAL = {
  nome: '',
  razao_social: '',
  cnpj: '',
  responsavel_tipo: 'rl',
  responsavel_nome: '',
  email: '',
  whatsapp: '',
  fixo: '',
  fidelidade_fim: '',
  operadora_atual_id: '',
  quantidade_chips: ''
};

function normalizarDataInput(valor) {
  if (!valor) return '';

  const texto = String(valor).slice(0, 10);
  return texto === '1899-11-30' ? '' : texto;
}

function formatarTelefoneComDdd(valor, celular = false) {
  const limite = celular ? 11 : 10;
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, limite);

  if (digitos.length <= 2) {
    return digitos ? `(${digitos}` : '';
  }

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);

  if (celular) {
    if (numero.length <= 5) return `(${ddd}) ${numero}`;
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }

  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

function juntarTelefone(ddd, numero, celular = false) {
  return formatarTelefoneComDdd(`${ddd || ''}${numero || ''}`, celular);
}

function separarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) {
    return { ddd: null, numero: null };
  }

  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function montarPayloadCliente(form) {
  const whatsapp = separarTelefone(form.whatsapp);
  const fixo = separarTelefone(form.fixo);

  return {
    ...form,
    whatsapp_ddd: whatsapp.ddd,
    whatsapp_numero: whatsapp.numero,
    fixo_ddd: fixo.ddd,
    fixo_numero: fixo.numero,
    fidelidade_fim: form.fidelidade_fim || null,
    operadora_atual_id: form.operadora_atual_id ? Number(form.operadora_atual_id) : null,
    quantidade_chips: form.quantidade_chips !== '' ? Number(form.quantidade_chips) : null
  };
}

function normalizarClienteForm(cliente) {
  if (!cliente) return FORM_INICIAL;

  return {
    nome: cliente.nome || '',
    razao_social: cliente.razao_social || '',
    cnpj: cliente.cnpj || '',
    responsavel_tipo: cliente.responsavel_tipo || 'rl',
    responsavel_nome: cliente.responsavel_nome || '',
    email: cliente.email || '',
    whatsapp: juntarTelefone(cliente.whatsapp_ddd, cliente.whatsapp_numero, true),
    fixo: juntarTelefone(cliente.fixo_ddd, cliente.fixo_numero),
    fidelidade_fim: normalizarDataInput(cliente.fidelidade_fim),
    operadora_atual_id: cliente.operadora_atual_id || '',
    quantidade_chips: cliente.quantidade_chips ?? ''
  };
}

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

function ClienteModal({ cliente, operadoras, onClose, onSave }) {
  const [form, setForm] = useState(() => normalizarClienteForm(cliente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const editando = Boolean(cliente);

  function atualizarCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      await onSave(montarPayloadCliente(form));
    } catch (error) {
      setErro(error.message || 'Erro ao salvar cliente.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal cliente-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{editando ? 'Editar cliente' : 'Novo cliente'}</div>
              <div className="modal-sub">Atualize representantes, contatos e dados de fidelidade.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="cliente-form-grid">
            <div className="form-field">
              <label>Nome</label>
              <input value={form.nome} onChange={event => atualizarCampo('nome', event.target.value)} required />
            </div>

            <div className="form-field">
              <label>Razao social</label>
              <input value={form.razao_social} onChange={event => atualizarCampo('razao_social', event.target.value)} />
            </div>

            <div className="form-field">
              <label>CNPJ</label>
              <input value={form.cnpj} onChange={event => atualizarCampo('cnpj', event.target.value)} />
            </div>

            <div className="form-field">
              <label>Operadora atual</label>
              <select value={form.operadora_atual_id} onChange={event => atualizarCampo('operadora_atual_id', event.target.value)}>
                <option value="">Selecione</option>
                {operadoras.map(operadora => (
                  <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Tipo</label>
              <select value={form.responsavel_tipo} onChange={event => atualizarCampo('responsavel_tipo', event.target.value)}>
                <option value="rl">RL</option>
                <option value="adm">ADM</option>
              </select>
            </div>

            <div className="form-field">
              <label>Nome do ADM/RL</label>
              <input value={form.responsavel_nome} onChange={event => atualizarCampo('responsavel_nome', event.target.value)} />
            </div>

            <div className="form-field span-2">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={event => atualizarCampo('email', event.target.value)} />
            </div>

            <div className="form-field">
              <label>WhatsApp com DDD</label>
              <input
                value={form.whatsapp}
                onChange={event => atualizarCampo('whatsapp', formatarTelefoneComDdd(event.target.value, true))}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                maxLength={15}
              />
            </div>

            <div className="form-field">
              <label>Fixo com DDD</label>
              <input
                value={form.fixo}
                onChange={event => atualizarCampo('fixo', formatarTelefoneComDdd(event.target.value))}
                placeholder="(11) 9999-9999"
                inputMode="numeric"
                maxLength={14}
              />
            </div>

            <div className="form-field">
              <label>Quantidade de chip</label>
              <input type="number" min="0" value={form.quantidade_chips} onChange={event => atualizarCampo('quantidade_chips', event.target.value)} />
            </div>

            <div className="form-field">
              <label>Fim da fidelidade</label>
              <input type="date" value={form.fidelidade_fim} onChange={event => atualizarCampo('fidelidade_fim', event.target.value)} />
            </div>
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar cliente'}
          </button>
        </div>
      </form>
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
              <strong>Este cliente sera enviado para a lixeira.</strong>
              <span>Ele ficara disponivel para restauracao e sera permanentemente deletado daqui a 1 mes.</span>
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

function Clientes() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();

  const podeCriar = temPermissao(usuario, 'clientes_criar');
  const podeEditar = temPermissao(usuario, 'clientes_editar');
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');

  const [clientes, setClientes] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [busca, setBusca] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [responsavelTipo, setResponsavelTipo] = useState('');
  const [fidelidade, setFidelidade] = useState('');
  const [chipsMin, setChipsMin] = useState('');
  const [chipsMax, setChipsMax] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [clienteModal, setClienteModal] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteParaLixeira, setClienteParaLixeira] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const filtros = useMemo(() => ({
    busca,
    operadora_atual_id: operadoraId,
    responsavel_tipo: responsavelTipo,
    fidelidade,
    chips_min: chipsMin,
    chips_max: chipsMax
  }), [busca, operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = useMemo(() => (
    [operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]
      .filter(v => v !== '').length
  ), [operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]);

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
      const [dados, operadorasData] = await Promise.all([
        listarClientes(proximosFiltros),
        listarOperadoras()
      ]);
      setClientes(dados);
      setOperadoras(operadorasData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarClientes();
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const clientesComAviso = useMemo(() => (
    clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar).length
  ), [clientes]);

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes(filtros);
  }

  function limparFiltros() {
    setBusca('');
    setOperadoraId('');
    setResponsavelTipo('');
    setFidelidade('');
    setChipsMin('');
    setChipsMax('');
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

      <ConfirmarLixeiraModal
        cliente={clienteParaLixeira}
        excluindo={excluindo}
        onClose={() => setClienteParaLixeira(null)}
        onConfirm={confirmarExclusaoCliente}
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
              <button className="btn btn-primary" onClick={abrirNovoCliente}>
                <I.Plus size={14} /> Novo cliente
              </button>
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
                  <th>Chips</th>
                  <th>Fidelidade</th>
                  <th>Excluir</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => {
                    const contato = formatarContato(cliente);
                    const fidelidade = formatarFidelidade(cliente.aviso_fidelidade);

                    return (
                      <tr
                        key={cliente.id}
                        className={podeEditar ? 'clickable-row' : ''}
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
                            <strong>{cliente.nome}</strong>
                            <span>{cliente.razao_social || 'Sem razao social'} - {cliente.cnpj || 'Sem CNPJ'}</span>
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
                        <td>{cliente.quantidade_chips ?? '-'}</td>
                        <td>
                          <span className={`pill ${fidelidade.className}`}>
                            <span className="pill-dot"></span>
                            {fidelidade.label}
                          </span>
                        </td>
                        <td>
                          <div className="clientes-actions">
                            {podeExcluir ? (
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
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default Clientes;
