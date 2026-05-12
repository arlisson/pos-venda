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

function ConfirmarExclusaoDefinitivaModal({ cliente, excluindo, onClose, onConfirm }) {
  if (!cliente) return null;

  return (
    <div className="modal-overlay" onClick={event => !excluindo && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Excluir cliente definitivamente?</div>
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
              <strong>Esta exclusão não pode ser desfeita.</strong>
              <span>O cliente será removido permanentemente da lixeira.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={excluindo}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={excluindo}>
            {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientesLixeiraPage() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [processandoId, setProcessandoId] = useState(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState(null);

  const filtros = useMemo(() => ({ busca }), [busca]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

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
    setSucesso('');

    try {
      await restaurarCliente(cliente.id);
      setClientes(prev => prev.filter(item => item.id !== cliente.id));
      setSucesso('Cliente restaurado com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao restaurar cliente.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function confirmarExclusaoDefinitiva() {
    if (!clienteParaExcluir) return;

    setProcessandoId(clienteParaExcluir.id);
    setErro('');
    setSucesso('');

    try {
      await excluirClienteDefinitivo(clienteParaExcluir.id);
      setClientes(prev => prev.filter(item => item.id !== clienteParaExcluir.id));
      setClienteParaExcluir(null);
      setSucesso('Cliente excluído definitivamente.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir cliente definitivamente.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <LayoutPrivado>
      <ConfirmarExclusaoDefinitivaModal
        cliente={clienteParaExcluir}
        excluindo={processandoId === clienteParaExcluir?.id}
        onClose={() => setClienteParaExcluir(null)}
        onConfirm={confirmarExclusaoDefinitiva}
      />

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
                  <th>Enviado em</th>
                  <th>Exclusão definitiva</th>
                  <th>Enviado por</th>
                  {podeExcluir && <th>Ações</th>}
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
                              onClick={() => setClienteParaExcluir(cliente)}
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
