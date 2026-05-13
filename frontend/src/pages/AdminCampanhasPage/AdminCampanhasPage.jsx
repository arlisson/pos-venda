import React, { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { createCampanha, deleteCampanha, getCampanhas, updateCampanhas } from '../../services/campanha.service';
import { listarOperadoras } from '../../services/config.service';
import * as I from '../../components/Icons';

const PERIODOS = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

const CATEGORIAS = [
  { value: 'registro_cliente', label: 'Registro de cliente' },
  { value: 'chip_novo', label: 'Chip novo' },
  { value: 'portabilidade', label: 'Portabilidade' },
  { value: 'internet', label: 'Internet' },
];

const inputStyle = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: '4px'
};

function AdminCampanhasPage() {
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [operadoras, setOperadoras] = useState([]);

  useEffect(() => {
    loadCampanhas();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), message.type === 'success' ? 4000 : 6000);
    return () => clearTimeout(timer);
  }, [message]);

  async function loadCampanhas() {
    try {
      const [data, operadorasData] = await Promise.all([
        getCampanhas(),
        listarOperadoras()
      ]);
      setCampanhas(data);
      setOperadoras(operadorasData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCampanhasChange(id, field, value) {
    setCampanhas(prev => prev.map(campanha => {
      if (campanha.id !== id) return campanha;

      const updated = { ...campanha, [field]: value };
      if (field === 'periodo' || field === 'categoria') {
        updated.tipo = `${updated.periodo || 'diaria'}_${updated.categoria || 'registro_cliente'}`;
      }

      return updated;
    }));
  }

  async function handleAddCampanha() {
    setSaving(true);
    setMessage(null);

    try {
      const campanha = await createCampanha({
        periodo: 'diaria',
        categoria: 'registro_cliente',
        target: 1,
        desc: 'Registrar 1 cliente',
        reward: '',
        operadora_id: null
      });

      setCampanhas(prev => [...prev, campanha]);
      setMessage({ type: 'success', text: 'Campanha adicionada com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao adicionar campanha.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCampanha(id) {
    if (!window.confirm('Deseja excluir esta campanha?')) return;

    setSaving(true);
    setMessage(null);

    try {
      await deleteCampanha(id);
      setCampanhas(prev => prev.filter(campanha => campanha.id !== id));
      setMessage({ type: 'success', text: 'Campanha excluída com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao excluir campanha.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      await updateCampanhas(campanhas);
      setMessage({ type: 'success', text: 'Campanhas atualizadas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
      await loadCampanhas();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar as campanhas.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando campanhas...</div>
      </LayoutPrivado>
    );
  }

  const diaria = campanhas.find(campanha => !campanha.is_gift);
  const gifts = campanhas.filter(campanha => campanha.is_gift);

  return (
    <LayoutPrivado>
      <div className="page" style={{ padding: 24, overflowY: 'auto' }}>
        {message && (
          <div
            className={`alert-${message.type === 'success' ? 'success' : 'error'} alert-timed alert-timed--${message.type === 'success' ? 'success' : 'error'}`}
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 6,
              background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: message.type === 'success' ? '#15803d' : '#991b1b'
            }}
          >
            {message.text}
          </div>
        )}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <h3>Campanha Diária Global</h3>
            <span className="muted" style={{ fontSize: 12 }}>Define o alvo total de vendas do dia</span>
          </div>
          <div className="panel-body">
            {diaria && (
              <div className="form-grid" style={{ marginBottom: 0 }}>
                <div className="form-field">
                  <label>Alvo (Quantidade de Vendas)</label>
                  <input
                    type="number"
                    value={diaria.target}
                    onChange={event => handleCampanhasChange(diaria.id, 'target', parseInt(event.target.value, 10) || 0)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Gamificação: Presentes e Recompensas</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                Configure campanhas por período e categoria comercial
              </span>
            </div>
            <button type="button" className="btn btn-sm" onClick={handleAddCampanha} disabled={saving}>
              <I.Plus size={14} /> Adicionar campanha
            </button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="list-table" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '14%' }}>Período</th>
                    <th style={{ width: '20%' }}>Categoria</th>
                    <th style={{ width: '10%' }}>Operadora</th>
                    <th style={{ width: '10%' }}>Alvo</th>
                    <th style={{ width: '24%' }}>Descrição Exibida</th>
                    <th style={{ width: '18%' }}>Recompensa</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {gifts.map(gift => (
                    <tr key={gift.id}>
                      <td>
                        <select
                          style={inputStyle}
                          value={gift.periodo || 'diaria'}
                          onChange={event => handleCampanhasChange(gift.id, 'periodo', event.target.value)}
                        >
                          {PERIODOS.map(periodo => (
                            <option key={periodo.value} value={periodo.value}>{periodo.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          style={inputStyle}
                          value={gift.categoria || 'registro_cliente'}
                          onChange={event => handleCampanhasChange(gift.id, 'categoria', event.target.value)}
                        >
                          {CATEGORIAS.map(categoria => (
                            <option key={categoria.value} value={categoria.value}>{categoria.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          style={inputStyle}
                          value={gift.operadora_id || ''}
                          onChange={event => handleCampanhasChange(gift.id, 'operadora_id', event.target.value || null)}
                        >
                          <option value="">Todas</option>
                          {operadoras.map(operadora => (
                            <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={inputStyle}
                          value={gift.target}
                          onChange={event => handleCampanhasChange(gift.id, 'target', parseInt(event.target.value, 10) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={inputStyle}
                          value={gift.desc}
                          onChange={event => handleCampanhasChange(gift.id, 'desc', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={inputStyle}
                          value={gift.reward || ''}
                          onChange={event => handleCampanhasChange(gift.id, 'reward', event.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost btn-danger-icon"
                          title="Excluir campanha"
                          onClick={() => handleDeleteCampanha(gift.id)}
                          disabled={saving}
                        >
                          <I.Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {gifts.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                        Nenhuma campanha de recompensa cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <I.Check size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default AdminCampanhasPage;
