import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { excluirClienteDefinitivo, listarClientesLixeira, restaurarCliente } from '../../services/cliente.service';
import './Clientes.css';

function formatarData(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function ClientesLixeiraPage() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  const filtros = useMemo(() => ({ busca }), [busca]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  async function carregarClientes(proximosFiltros = filtros) {
    setErro('');
    setCarregando(true);

    try {
      setClientes(await listarClientesLixeira(proximosFiltros));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar lixeira de clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarClientes();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes(filtros);
  }

  async function handleRestaurar(cliente) {
    setProcessandoId(cliente.id);
    setErro('');

    try {
      await restaurarCliente(cliente.id);
      setClientes(prev => prev.filter(item => item.id !== cliente.id));
    } catch (error) {
      setErro(error.message || 'Erro ao restaurar cliente.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleExcluirDefinitivo(cliente) {
    const confirmado = window.confirm('Excluir este cliente definitivamente? Essa ação não pode ser desfeita.');

    if (!confirmado) return;

    setProcessandoId(cliente.id);
    setErro('');

    try {
      await excluirClienteDefinitivo(cliente.id);
      setClientes(prev => prev.filter(item => item.id !== cliente.id));
    } catch (error) {
      setErro(error.message || 'Erro ao excluir cliente definitivamente.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <LayoutPrivado>
      <div className="clientes-page">
        <div className="clientes-toolbar">
          <div className="clientes-toolbar__meta">{clientes.length} clientes na lixeira</div>

          <div className="clientes-toolbar__actions">
            <form className="clientes-search" onSubmit={handleBuscar}>
              <I.Search size={14} />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder="Buscar na lixeira de clientes"
              />
            </form>

            <button className="btn" type="button" onClick={() => navigate('/clientes')}>
              <I.ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Voltar
            </button>
          </div>
        </div>

        {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsavel</th>
                  <th>Contato</th>
                  <th>Enviado em</th>
                  <th>Exclusao definitiva</th>
                  <th>Enviado por</th>
                  {podeExcluir && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeExcluir ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando lixeira...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={podeExcluir ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente na lixeira.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => (
                    <tr key={cliente.id}>
                      <td>
                        <div className="cliente-primary">
                          <strong>{cliente.nome}</strong>
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
                          <span>{[cliente.whatsapp_ddd, cliente.whatsapp_numero].filter(Boolean).join(' ') || '-'}</span>
                        </div>
                      </td>
                      <td>{formatarData(cliente.excluido_em)}</td>
                      <td>{formatarData(cliente.excluir_definitivo_em)}</td>
                      <td><span className="tag">{cliente.excluidoPor?.nome || '-'}</span></td>
                      {podeExcluir && (
                        <td>
                          <div className="clientes-actions">
                            <button className="btn btn-sm" disabled={processandoId === cliente.id} onClick={() => handleRestaurar(cliente)}>
                              <I.Return size={13} /> Restaurar
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                              disabled={processandoId === cliente.id}
                              onClick={() => handleExcluirDefinitivo(cliente)}
                            >
                              <I.Trash size={13} /> Excluir
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default ClientesLixeiraPage;
