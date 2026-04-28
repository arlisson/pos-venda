import React, { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { createMeta, deleteMeta, getMetas, updateMetas } from '../../services/meta.service';
import * as I from '../../components/Icons';

const PERIODOS = [
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
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

function AdminMetasPage() {
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadMetas();
  }, []);

  async function loadMetas() {
    try {
      const data = await getMetas();
      setMetas(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleMetasChange(id, field, value) {
    setMetas(prev => prev.map(meta => {
      if (meta.id !== id) return meta;

      const updated = { ...meta, [field]: value };
      if (field === 'periodo' || field === 'categoria') {
        updated.tipo = `${updated.periodo || 'diaria'}_${updated.categoria || 'registro_cliente'}`;
      }

      return updated;
    }));
  }

  async function handleAddMeta() {
    setSaving(true);
    setMessage(null);

    try {
      const meta = await createMeta({
        periodo: 'diaria',
        categoria: 'registro_cliente',
        target: 1,
        desc: 'Registrar 1 cliente',
        reward: ''
      });

      setMetas(prev => [...prev, meta]);
      setMessage({ type: 'success', text: 'Meta adicionada com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao adicionar meta.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMeta(id) {
    if (!window.confirm('Deseja excluir esta meta?')) return;

    setSaving(true);
    setMessage(null);

    try {
      await deleteMeta(id);
      setMetas(prev => prev.filter(meta => meta.id !== id));
      setMessage({ type: 'success', text: 'Meta excluida com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao excluir meta.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      await updateMetas(metas);
      setMessage({ type: 'success', text: 'Metas atualizadas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
      await loadMetas();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar as metas.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando metas...</div>
      </LayoutPrivado>
    );
  }

  const diaria = metas.find(meta => !meta.is_gift);
  const gifts = metas.filter(meta => meta.is_gift);

  return (
    <LayoutPrivado>
      <div className="page" style={{ padding: 24, overflowY: 'auto' }}>
        {message && (
          <div
            className={`alert-${message.type === 'success' ? 'success' : 'error'}`}
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
            <h3>Meta Diaria Global</h3>
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
                    onChange={event => handleMetasChange(diaria.id, 'target', parseInt(event.target.value, 10) || 0)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Gamificacao: Presentes e Recompensas</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                Configure metas por periodo e categoria comercial
              </span>
            </div>
            <button type="button" className="btn btn-sm" onClick={handleAddMeta} disabled={saving}>
              <I.Plus size={14} /> Adicionar meta
            </button>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="list-table" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '14%' }}>Periodo</th>
                    <th style={{ width: '20%' }}>Categoria</th>
                    <th style={{ width: '10%' }}>Alvo</th>
                    <th style={{ width: '28%' }}>Descricao Exibida</th>
                    <th style={{ width: '22%' }}>Recompensa</th>
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
                          onChange={event => handleMetasChange(gift.id, 'periodo', event.target.value)}
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
                          onChange={event => handleMetasChange(gift.id, 'categoria', event.target.value)}
                        >
                          {CATEGORIAS.map(categoria => (
                            <option key={categoria.value} value={categoria.value}>{categoria.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          style={inputStyle}
                          value={gift.target}
                          onChange={event => handleMetasChange(gift.id, 'target', parseInt(event.target.value, 10) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={inputStyle}
                          value={gift.desc}
                          onChange={event => handleMetasChange(gift.id, 'desc', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          style={inputStyle}
                          value={gift.reward || ''}
                          onChange={event => handleMetasChange(gift.id, 'reward', event.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost"
                          title="Excluir meta"
                          onClick={() => handleDeleteMeta(gift.id)}
                          disabled={saving}
                        >
                          <I.Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {gifts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                        Nenhuma meta de recompensa cadastrada.
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
            <I.Check size={16} /> {saving ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default AdminMetasPage;
