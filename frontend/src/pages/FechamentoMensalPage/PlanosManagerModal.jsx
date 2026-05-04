import { useEffect, useState } from 'react';
import * as I from '../../components/Icons';
import { listarOperadoras } from '../../services/config.service';
import { atualizarPlano, criarPlano, excluirPlano, listarPlanos } from '../../services/plano.service';

const CATEGORIAS = [
  { value: 'movel', label: 'Móvel' },
  { value: 'fixo', label: 'Fixo' },
  { value: 'internet', label: 'Internet' }
];

const TIPOS_SERVICO = [
  { value: 'novo', label: 'Novo' },
  { value: 'portabilidade', label: 'Portabilidade' }
];

const novoPlanoVazio = () => ({
  nome: '',
  operadora_id: '',
  categoria: 'movel',
  tipo_servico: 'novo',
  taxa_comissao: 0
});

function PlanosManagerModal({ onClose }) {
  const [planos, setPlanos] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [novoPlano, setNovoPlano] = useState(novoPlanoVazio());
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [listaPlanos, listaOperadoras] = await Promise.all([
        listarPlanos(),
        listarOperadoras()
      ]);
      setPlanos(listaPlanos || []);
      setOperadoras(listaOperadoras || []);
    } catch (err) {
      setErro(err?.message || 'Erro ao carregar planos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleAdicionar() {
    if (!novoPlano.nome.trim() || !novoPlano.operadora_id) {
      setErro('Informe nome e operadora.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const criado = await criarPlano({
        nome: novoPlano.nome.trim(),
        operadora_id: Number(novoPlano.operadora_id),
        categoria: novoPlano.categoria,
        tipo_servico: novoPlano.tipo_servico,
        taxa_comissao: Number(novoPlano.taxa_comissao) || 0
      });
      setPlanos(prev => [criado, ...prev]);
      setNovoPlano(novoPlanoVazio());
    } catch (err) {
      setErro(err?.message || 'Erro ao criar plano.');
    } finally {
      setSalvando(false);
    }
  }

  function handleEditar(id, campo, valor) {
    setPlanos(prev => prev.map(plano => {
      if (plano.id !== id) return plano;
      return { ...plano, [campo]: valor };
    }));
  }

  async function handleSalvarLinha(plano) {
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await atualizarPlano(plano.id, {
        nome: plano.nome,
        operadora_id: Number(plano.operadora_id),
        categoria: plano.categoria,
        tipo_servico: plano.tipo_servico,
        taxa_comissao: Number(plano.taxa_comissao) || 0,
        ativo: plano.ativo
      });
      setPlanos(prev => prev.map(p => (p.id === plano.id ? atualizado : p)));
    } catch (err) {
      setErro(err?.message || 'Erro ao atualizar plano.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (!window.confirm('Excluir este plano? Vendas vinculadas mantêm o registro mas perdem a referência.')) return;

    setSalvando(true);
    setErro(null);
    try {
      await excluirPlano(id);
      setPlanos(prev => prev.filter(plano => plano.id !== id));
    } catch (err) {
      setErro(err?.message || 'Erro ao excluir plano.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fechamento-modal-large" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Planos e taxa de comissão</div>
              <div className="modal-sub">
                Cadastre planos por operadora, categoria e tipo de serviço. A taxa é aplicada sobre o valor unitário do chip.
              </div>
            </div>
            <button type="button" className="btn-icon btn-ghost" onClick={onClose} aria-label="Fechar">
              <I.Close size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {erro && <div className="alert-error" style={{ margin: 16 }}>{erro}</div>}

          <div className="plano-form">
            <div className="form-field">
              <label>Nome</label>
              <input
                type="text"
                value={novoPlano.nome}
                onChange={event => setNovoPlano(prev => ({ ...prev, nome: event.target.value }))}
                placeholder="Ex: TIM 50GB"
              />
            </div>
            <div className="form-field">
              <label>Operadora</label>
              <select
                value={novoPlano.operadora_id}
                onChange={event => setNovoPlano(prev => ({ ...prev, operadora_id: event.target.value }))}
              >
                <option value="">Selecione...</option>
                {operadoras.map(op => (
                  <option key={op.id} value={op.id}>{op.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Categoria</label>
              <select
                value={novoPlano.categoria}
                onChange={event => setNovoPlano(prev => ({ ...prev, categoria: event.target.value }))}
              >
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Tipo</label>
              <select
                value={novoPlano.tipo_servico}
                onChange={event => setNovoPlano(prev => ({ ...prev, tipo_servico: event.target.value }))}
              >
                {TIPOS_SERVICO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Taxa (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={novoPlano.taxa_comissao}
                onChange={event => setNovoPlano(prev => ({ ...prev, taxa_comissao: event.target.value }))}
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleAdicionar}
              disabled={salvando}
              style={{ height: 32 }}
            >
              <I.Plus size={14} /> Adicionar
            </button>
          </div>

          {loading ? (
            <div className="fechamento-empty">Carregando planos...</div>
          ) : planos.length === 0 ? (
            <div className="fechamento-empty">Nenhum plano cadastrado.</div>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
              <table className="plano-list-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Operadora</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Taxa (%)</th>
                    <th>Ativo</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {planos.map(plano => (
                    <tr key={plano.id}>
                      <td>
                        <input
                          type="text"
                          value={plano.nome}
                          onChange={event => handleEditar(plano.id, 'nome', event.target.value)}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <select
                          value={plano.operadora_id}
                          onChange={event => handleEditar(plano.id, 'operadora_id', Number(event.target.value))}
                        >
                          {operadoras.map(op => (
                            <option key={op.id} value={op.id}>{op.nome}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={plano.categoria}
                          onChange={event => handleEditar(plano.id, 'categoria', event.target.value)}
                        >
                          {CATEGORIAS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={plano.tipo_servico}
                          onChange={event => handleEditar(plano.id, 'tipo_servico', event.target.value)}
                        >
                          {TIPOS_SERVICO.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="taxa"
                          value={plano.taxa_comissao}
                          onChange={event => handleEditar(plano.id, 'taxa_comissao', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!plano.ativo}
                          onChange={event => handleEditar(plano.id, 'ativo', event.target.checked)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleSalvarLinha(plano)}
                            disabled={salvando}
                            title="Salvar alterações"
                          >
                            <I.Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost btn-danger-icon"
                            onClick={() => handleExcluir(plano.id)}
                            disabled={salvando}
                            title="Excluir"
                          >
                            <I.Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

export default PlanosManagerModal;
