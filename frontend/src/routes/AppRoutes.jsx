import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage/LoginPage';
import PerfilPage from '../pages/PerfilPage/PerfilPage';
import HomePage from '../pages/HomePage/HomePage';
import CadastroUsuario from '../pages/CadastroUsuario/CadastroUsuario';
import Usuarios from '../pages/Usuarios/Usuarios';
import EditarPerfilPage from '../pages/EditarPerfilPage/EditarPerfilPage';

import { getUsuarioLocal } from '../services/auth.service';

function PrivateRoute({ children, permission }) {
  const token = localStorage.getItem('token');
  const usuario = getUsuarioLocal();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !usuario?.permissoes?.[permission]) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomePage />
          </PrivateRoute>
        }
      />

      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/perfil"
        element={
          <PrivateRoute>
            <PerfilPage />
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

      <Route
        path="/usuarios/cadastrar"
        element={
          <PrivateRoute permission="crud_usuarios">
            <CadastroUsuario />
          </PrivateRoute>
        }
      />

      <Route
        path="/perfil/editar"
        element={
          <PrivateRoute>
            <EditarPerfilPage />
          </PrivateRoute>
        }
      />
      
    </Routes>
  );
}

export default AppRoutes;