import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage/LoginPage';
import PerfilPage from '../pages/PerfilPage/PerfilPage';
import Usuarios from '../pages/Usuarios/Usuarios';
import CadastroUsuario from '../pages/CadastroUsuario/CadastroUsuario';
import HomePage from '../pages/HomePage/HomePage';
import EditarPerfilPage from '../pages/EditarPerfilPage/EditarPerfilPage';
import EditarUsuarioPage from '../pages/EditarUsuarioPage/EditarUsuarioPage';
import HistoricoPage from '../pages/HistoricoPage/HistoricoPage';
import '../pages/HistoricoPage/HistoricoPage.css';

import { getUsuarioLocal, temPermissao } from '../services/auth.service';

function PrivateRoute({ children, permission }) {
  const token = localStorage.getItem('token');
  const usuario = getUsuarioLocal();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !temPermissao(usuario, permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

const Placeholder = ({ title }) => (
  <div className="empty" style={{ padding: '100px' }}>
    <h2>{title}</h2>
    <p className="muted">Esta funcionalidade está em desenvolvimento.</p>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      <Route path="/login" element={<LoginPage />} />

      <Route path="/perfil" element={<PrivateRoute><PerfilPage /></PrivateRoute>} />

      <Route path="/perfil/editar" element={<PrivateRoute><EditarPerfilPage /></PrivateRoute>} />

      <Route
        path="/usuarios"
        element={<PrivateRoute permission="crud_usuarios"><Usuarios /></PrivateRoute>}
      />

      <Route
        path="/usuarios/novo"
        element={<PrivateRoute permission="crud_usuarios"><CadastroUsuario /></PrivateRoute>}
      />

      <Route
        path="/usuarios/cadastrar"
        element={<PrivateRoute permission="crud_usuarios"><CadastroUsuario /></PrivateRoute>}
      />

      <Route
        path="/usuarios/:id/editar"
        element={<PrivateRoute permission="crud_usuarios"><EditarUsuarioPage /></PrivateRoute>}
      />

      <Route path="/retornos" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/historico" element={<PrivateRoute><HistoricoPage /></PrivateRoute>} />
      <Route path="/configuracoes" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
