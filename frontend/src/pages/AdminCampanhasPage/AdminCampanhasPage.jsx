import React, { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { createCampanha, deleteCampanha, getCampanhas, updateCampanhas } from '../../services/campanha.service';
import { listarOperadoras } from '../../services/config.service';
import * as I from '../../components/Icons';
import './AdminCampanhasPage.css';

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

  const gifts = campanhas.filter(campanha => campanha.is_gift);

  return (
    <LayoutPrivado>
      <div className="page admin-campanhas-page" style={{ padding: 24, overflowY: 'auto' }}>
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
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Gamificação: Presentes e Recompensas</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                Configure campanhas por período e categoria comercial
              </span>
            </div>
            <button type="button" className="btn btn-sm admin-campanhas-add-button" onClick={handleAddCampanha} disabled={saving}>
              <I.Plus size={14} /> Adicionar campanha
            </button>
          </div>
          <div className="panel-body admin-campanhas-rewards-panel__body" style={{ padding: 0 }}>
            <div className="list-table list-table--scroll-mobile admin-campanhas-table" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
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
                    <tr key={gift.id} className="admin-campanhas-card-row">
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--periodo" data-label="Periodo">
                        <select
                          className="admin-campanhas-control"
                          value={gift.periodo || 'diaria'}
                          onChange={event => handleCampanhasChange(gift.id, 'periodo', event.target.value)}
                        >
                          {PERIODOS.map(periodo => (
                            <option key={periodo.value} value={periodo.value}>{periodo.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--categoria" data-label="Categoria">
                        <select
                          className="admin-campanhas-control"
                          value={gift.categoria || 'registro_cliente'}
                          onChange={event => handleCampanhasChange(gift.id, 'categoria', event.target.value)}
                        >
                          {CATEGORIAS.map(categoria => (
                            <option key={categoria.value} value={categoria.value}>{categoria.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--operadora" data-label="Operadora">
                        <select
                          className="admin-campanhas-control"
                          value={gift.operadora_id || ''}
                          onChange={event => handleCampanhasChange(gift.id, 'operadora_id', event.target.value || null)}
                        >
                          <option value="">Todas</option>
                          {operadoras.map(operadora => (
                            <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                          ))}
                        </select>
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--alvo" data-label="Alvo">
                        <input
                          className="admin-campanhas-control"
                          type="number"
                          value={gift.target}
                          onChange={event => handleCampanhasChange(gift.id, 'target', parseInt(event.target.value, 10) || 0)}
                        />
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--descricao" data-label="Descricao exibida">
                        <input
                          className="admin-campanhas-control"
                          type="text"
                          value={gift.desc}
                          onChange={event => handleCampanhasChange(gift.id, 'desc', event.target.value)}
                        />
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--recompensa" data-label="Recompensa">
                        <input
                          className="admin-campanhas-control"
                          type="text"
                          value={gift.reward || ''}
                          onChange={event => handleCampanhasChange(gift.id, 'reward', event.target.value)}
                        />
                      </td>
                      <td className="admin-campanhas-card-field admin-campanhas-card-field--acoes" data-label="Acoes" style={{ textAlign: 'right' }}>
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
                    <tr className="admin-campanhas-empty-row">
                      <td className="admin-campanhas-empty-cell" colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                        Nenhuma campanha de recompensa cadastrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="admin-campanhas-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <I.Check size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default AdminCampanhasPage;
