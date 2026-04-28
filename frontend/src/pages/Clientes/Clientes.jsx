import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { excluirCliente, listarClientes } from '../../services/cliente.service';
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

function Clientes() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();

  const podeCriar = temPermissao(usuario, 'clientes_criar');
  const podeEditar = temPermissao(usuario, 'clientes_editar');
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');

  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);

  async function carregarClientes(filtros = {}) {
    setErro('');
    setCarregando(true);

    try {
      const dados = await listarClientes(filtros);
      setClientes(dados);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregarClientes();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const clientesComAviso = useMemo(() => (
    clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar).length
  ), [clientes]);

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes({ busca });
  }

  async function handleExcluir(cliente) {
    if (excluindoId !== cliente.id) {
      setExcluindoId(cliente.id);
      return;
    }

    try {
      await excluirCliente(cliente.id);
      setClientes(prev => prev.filter(item => item.id !== cliente.id));
    } catch (error) {
      setErro(error.message || 'Erro ao excluir cliente.');
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <LayoutPrivado>
      <div className="clientes-page">
        <div className="clientes-toolbar">
          <div className="clientes-toolbar__meta">
            {clientes.length} clientes cadastrados
            {clientesComAviso > 0 ? ` - ${clientesComAviso} aviso(s) de fidelidade` : ''}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <form className="clientes-search" onSubmit={handleBuscar}>
              <I.Search size={14} />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder="Buscar por nome, CNPJ, e-mail..."
              />
            </form>

            {podeCriar && (
              <button className="btn btn-primary" onClick={() => navigate('/clientes/novo')}>
                <I.Plus size={14} /> Novo cliente
              </button>
            )}
          </div>
        </div>

        {erro && <div className="alert-error">{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsavel</th>
                  <th>Contato</th>
                  <th>Operadora</th>
                  <th>Chips</th>
                  <th>Fidelidade</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => {
                    const contato = formatarContato(cliente);
                    const fidelidade = formatarFidelidade(cliente.aviso_fidelidade);

                    return (
                      <tr key={cliente.id}>
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
                        <td>{cliente.quantidade_chips ?? '-'}</td>
                        <td>
                          <span className={`pill ${fidelidade.className}`}>
                            <span className="pill-dot"></span>
                            {fidelidade.label}
                          </span>
                        </td>
                        <td>
                          <div className="clientes-actions">
                            {podeEditar && (
                              <button className="btn btn-icon btn-ghost" title="Editar" onClick={() => navigate(`/clientes/${cliente.id}/editar`)}>
                                <I.Edit size={13} />
                              </button>
                            )}

                            {podeExcluir && excluindoId === cliente.id ? (
                              <>
                                <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleExcluir(cliente)}>
                                  Confirmar
                                </button>
                                <button className="btn btn-sm btn-ghost" onClick={() => setExcluindoId(null)}>
                                  Cancelar
                                </button>
                              </>
                            ) : podeExcluir ? (
                              <button className="btn btn-icon btn-ghost" title="Excluir" onClick={() => handleExcluir(cliente)}>
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
