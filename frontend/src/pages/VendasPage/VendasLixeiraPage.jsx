import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { deletarVendaDefinitivo, listarVendasLixeira, restaurarVenda } from '../../services/venda.service';
import './VendasPage.css';

function formatarData(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatarMoeda(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function VendasLixeiraPage() {
  const navigate = useNavigate();
  const [vendas, setVendas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);

  const filtros = useMemo(() => ({ busca }), [busca]);

  async function carregarDados(proximosFiltros = filtros) {
    setErro('');
    setCarregando(true);

    try {
      setVendas(await listarVendasLixeira(proximosFiltros));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar lixeira de vendas.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarDados();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarDados(filtros);
  }

  async function handleRestaurar(venda) {
    setProcessandoId(venda.id);
    setErro('');

    try {
      await restaurarVenda(venda.id);
      setVendas(prev => prev.filter(item => item.id !== venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao restaurar venda.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleExcluirDefinitivo(venda) {
    const confirmado = window.confirm('Excluir esta venda definitivamente? Essa acao nao pode ser desfeita.');

    if (!confirmado) return;

    setProcessandoId(venda.id);
    setErro('');

    try {
      await deletarVendaDefinitivo(venda.id);
      setVendas(prev => prev.filter(item => item.id !== venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao excluir venda definitivamente.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <LayoutPrivado>
      <div className="vendas-page">
        <div className="vendas-toolbar vendas-toolbar--trash">
          <form className="search-box" onSubmit={handleBuscar}>
            <I.Search size={14} />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar na lixeira de vendas"
            />
          </form>

          <button className="btn" type="button" onClick={() => navigate('/vendas')}>
            <I.ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Voltar
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          {vendas.length} vendas na lixeira
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Operadora</th>
                  <th>Servico</th>
                  <th>Valor</th>
                  <th>Enviada em</th>
                  <th>Exclusao definitiva</th>
                  <th>Enviada por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando lixeira...
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma venda na lixeira.
                    </td>
                  </tr>
                ) : (
                  vendas.map(venda => (
                    <tr key={venda.id}>
                      <td>
                        <div className="vendas-table-name">
                          <strong>{venda.cliente?.nome || venda.nome}</strong>
                          <span>{venda.cliente?.razao_social || venda.razao_social || venda.telefone || venda.email || '-'}</span>
                        </div>
                      </td>
                      <td><span className="tag">{venda.operadora?.nome || '-'}</span></td>
                      <td>{venda.servico?.nome || venda.tipoVenda?.nome || '-'}</td>
                      <td className="vendas-value">{formatarMoeda(venda.valor_total)}</td>
                      <td>{formatarData(venda.excluido_em)}</td>
                      <td>{formatarData(venda.excluir_definitivo_em)}</td>
                      <td><span className="tag">{venda.excluidoPor?.nome || '-'}</span></td>
                      <td className="row-actions">
                        <button className="btn btn-sm" disabled={processandoId === venda.id} onClick={() => handleRestaurar(venda)}>
                          <I.Return size={13} /> Restaurar
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          disabled={processandoId === venda.id}
                          onClick={() => handleExcluirDefinitivo(venda)}
                        >
                          <I.Trash size={13} /> Excluir
                        </button>
                      </td>
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

export default VendasLixeiraPage;
