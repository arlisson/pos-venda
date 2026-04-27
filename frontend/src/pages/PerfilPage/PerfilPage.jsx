import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Card from '../../components/Card/Card';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import { buscarPerfil, logout } from '../../services/auth.service';

import './PerfilPage.css';

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

  if (carregando) {
    return (
      <LayoutPrivado>
        <p>Carregando perfil...</p>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <Card>
        <h1 className="perfil-page__title">Meu perfil</h1>
        <p className="perfil-page__subtitle">
          Dados do usuário autenticado.
        </p>

        <div className="perfil-page__grid">
          <div className="perfil-page__info">
            <span>Nome</span>
            <strong>{usuario.nome}</strong>
          </div>

          <div className="perfil-page__info">
            <span>E-mail</span>
            <strong>{usuario.email}</strong>
          </div>

          <div className="perfil-page__info">
            <span>Status</span>
            <strong>{usuario.ativo ? 'Ativo' : 'Inativo'}</strong>
          </div>

          <div className="perfil-page__info">
            <span>Role</span>
            <strong>{usuario.role?.nome}</strong>
          </div>
        </div>

        <h2 className="perfil-page__section-title">Permissões</h2>

        <div className="perfil-page__permissions">
          {Object.entries(usuario.permissoes || {}).map(([modulo, permitido]) => (
            <div className="perfil-page__permission" key={modulo}>
              <span>{modulo}</span>

              <strong className={permitido ? 'is-allowed' : 'is-denied'}>
                {permitido ? 'Permitido' : 'Bloqueado'}
              </strong>
            </div>
          ))}
        </div>
      </Card>
    </LayoutPrivado>
  );
}

export default PerfilPage;