import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { buscarPerfil, logout } from '../../services/auth.service';
import * as I from '../../components/Icons';

function PerfilPage() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const data = await buscarPerfil();
        setUsuario(data);
      } catch (error) {
        logout();
        navigate('/login');
      } finally {
        setCarregando(false);
      }
    }

    carregarPerfil();
  }, [navigate]);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  if (carregando) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando perfil...</div>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <div className="users-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '30px' }}>
            <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '24px' }}>
              {getInitials(usuario?.nome)}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{usuario?.nome}</h2>
              <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>{usuario?.email}</div>
              <div style={{ marginTop: '8px' }}>
                <span className="tag">{usuario?.role?.nome}</span>
                <span className={`pill ${usuario?.ativo ? 'success' : ''}`} style={{ marginLeft: '8px' }}>
                  <span className="pill-dot"></span>{usuario?.ativo ? 'Conta Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/usuarios/editar/' + usuario?.id)}>
              <I.Edit size={14} /> Editar Perfil
            </button>
          </div>
        </div>

        <div className="dash-grid">
          <div className="panel">
            <div className="panel-header"><h3>Informações da Conta</h3></div>
            <div className="panel-body">
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="detail-item">
                  <div className="label">Nome de Exibição</div>
                  <div className="value">{usuario?.nome}</div>
                </div>
                <div className="detail-item">
                  <div className="label">E-mail de Acesso</div>
                  <div className="value mono">{usuario?.email}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Nível de Acesso</div>
                  <div className="value">{usuario?.role?.nome}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>Permissões Ativas</h3></div>
            <div className="panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {usuario?.role?.permissoes ? Object.entries(usuario.role.permissoes).map(([modulo, permitido]) => (
                  <div key={modulo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                    <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{modulo}</span>
                    <span className={`pill ${permitido ? 'success' : 'danger'}`}>
                      <span className="pill-dot"></span>
                      {permitido ? 'Permitido' : 'Bloqueado'}
                    </span>
                  </div>
                )) : <div className="muted">Nenhuma permissão específica.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default PerfilPage;
