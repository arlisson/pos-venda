import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage/LoginPage';
import PerfilPage from '../pages/PerfilPage/PerfilPage';
import CadastroUsuario from '../pages/CadastroUsuario/CadastroUsuario';
import Usuarios from '../pages/Usuarios/Usuarios';
import { getUsuarioLocal } from '../services/auth.service';

function PrivateRoute({ children, permission }) {
  const usuario = getUsuarioLocal();
  const token = localStorage.getItem('token');

  // Se não houver token ou o usuário não tiver a permissão necessária
  if (!token || (permission && !usuario?.role?.permissoes[permission])) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/perfil" element={<PerfilPage />} />

      <Route
        path="/usuarios/cadastrar"
        element={
          <PrivateRoute permission="crud_usuarios">
            <CadastroUsuario />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <PrivateRoute permission="crud_usuarios">
            <Usuarios />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;