import { useNavigate } from 'react-router-dom';

import Navbar from '../../components/Navbar/Navbar';
import { getUsuarioLocal, logout } from '../../services/auth.service';

import './LayoutPrivado.css';

function LayoutPrivado({ children }) {
  const navigate = useNavigate();

  const usuario = getUsuarioLocal();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout-privado">
      <Navbar usuario={usuario} onLogout={handleLogout} />

      <main className="layout-privado__content">
        {children}
      </main>
    </div>
  );
}

export default LayoutPrivado;