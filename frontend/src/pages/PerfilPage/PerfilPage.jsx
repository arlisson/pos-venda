import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { buscarPerfil, logout } from '../../services/auth.service';
import './PerfilPage.css';

function PerfilPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const data = await buscarPerfil();
        setUsuario(data);
      } catch (error) {
        setErro(error.message);
        logout();
      } finally {
        setCarregando(false);
      }
    }

    carregarPerfil();
  }, []);

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
      <div className="users-page perfil-page-clean">
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-body perfil-summary-card">
            <div className="avatar perfil-avatar">
              {usuario?.foto_perfil ? (
                <img src={usuario.foto_perfil} alt={usuario?.nome || 'Foto de perfil'} />
              ) : (
                getInitials(usuario?.nome)
              )}
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
            <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/perfil/editar')}>
              <I.Edit size={14} /> Editar Perfil
            </button>
          </div>
        </div>

        <div className="perfil-account-panel">
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
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default PerfilPage;
