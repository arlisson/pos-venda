import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarUsuarios } from '../../services/usuario.service';

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const dadosUsuarios = await listarUsuarios();
        setUsuarios(dadosUsuarios);
      } catch (error) {
        setErro('Erro ao carregar usuários.');
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuarios();
  }, []);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <LayoutPrivado>
      <div className="users-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {usuarios.length} usuários · {usuarios.filter(u => u.ativo).length} ativos
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/usuarios/novo')}
          >
            <I.Plus size={14} /> Adicionar usuário
          </button>
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Permissão</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {getInitials(u.nome)}
                          </span>
                          <span style={{ fontWeight: 500 }}>{u.nome}</span>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td><span className="tag">{u.role?.nome || 'Nenhum'}</span></td>
                      <td>
                        <span className={`pill ${u.ativo ? 'success' : ''}`}>
                          <span className="pill-dot"></span>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="row-actions">
                        <button className="btn btn-icon btn-ghost" onClick={() => navigate(`/usuarios/editar/${u.id}`)}>
                          <I.Edit size={13} />
                        </button>
                        <button className="btn btn-icon btn-ghost">
                          <I.More size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: 20 }}></div>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>Permissões por perfil</h3>
        <div className="settings-section">
          {[
            { role: 'Administrador', desc: 'Vê todas as vendas, gerencia usuários e configurações' },
            { role: 'Vendedor', desc: 'Vê apenas as próprias vendas. Pode lançar e atualizar status.' },
            { role: 'Pós-venda', desc: 'Vê todas as vendas. Atualiza status e marca retornos.' },
          ].map(p => (
            <div key={p.role} className="settings-row">
              <div>
                <div className="label">{p.role}</div>
                <div className="desc">{p.desc}</div>
              </div>
              <button className="btn btn-sm">Editar permissões</button>
            </div>
          ))}
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default Usuarios;
