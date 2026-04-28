import React, { useState, useEffect } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getMetas, updateMetas } from '../../services/meta.service';
import * as I from '../../components/Icons';

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

  const handleMetasChange = (id, field, value) => {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateMetas(metas);
      setMessage({ type: 'success', text: 'Metas atualizadas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar as metas.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando metas...</div>
      </LayoutPrivado>
    );
  }

  const diaria = metas.find(m => !m.is_gift);
  const gifts = metas.filter(m => m.is_gift);

  return (
    <LayoutPrivado>
      <div className="page" style={{ padding: 24, overflowY: 'auto' }}>
        
        {message && (
          <div className={`alert-${message.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 16, padding: 12, borderRadius: 6, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#15803d' : '#991b1b' }}>
            {message.text}
          </div>
        )}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <h3>Meta Diária Global</h3>
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
                    onChange={e => handleMetasChange(diaria.id, 'target', parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Gamificação: Presentes e Recompensas</h3>
            <span className="muted" style={{ fontSize: 12 }}>Define os 5 desafios do dia e suas respectivas premiações</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="list-table" style={{ margin: 0, borderRadius: 0, border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Tipo</th>
                    <th style={{ width: '15%' }}>Alvo</th>
                    <th style={{ width: '35%' }}>Descrição Exibida</th>
                    <th style={{ width: '35%' }}>Recompensa</th>
                  </tr>
                </thead>
                <tbody>
                  {gifts.map(gift => (
                    <tr key={gift.id}>
                      <td>
                        <div className="pill"><span className="pill-dot"></span>{gift.tipo}</div>
                      </td>
                      <td>
                        <input 
                          type="number" 
                          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          value={gift.target} 
                          onChange={e => handleMetasChange(gift.id, 'target', parseInt(e.target.value, 10))}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          value={gift.desc} 
                          onChange={e => handleMetasChange(gift.id, 'desc', e.target.value)}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '4px' }}
                          value={gift.reward} 
                          onChange={e => handleMetasChange(gift.id, 'reward', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <I.Check size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

      </div>
    </LayoutPrivado>
  );
}

export default AdminMetasPage;
