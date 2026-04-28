import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../pages/LoginPage/LoginPage';
import PerfilPage from '../pages/PerfilPage/PerfilPage';
import Usuarios from '../pages/Usuarios/Usuarios';
import CadastroUsuario from '../pages/CadastroUsuario/CadastroUsuario';
import FunilPage from '../pages/FunilPage/FunilPage';
import DashboardPage from '../pages/DashboardPage/DashboardPage';
import EditarPerfilPage from '../pages/EditarPerfilPage/EditarPerfilPage';
import EditarUsuarioPage from '../pages/EditarUsuarioPage/EditarUsuarioPage';
import HistoricoPage from '../pages/HistoricoPage/HistoricoPage';
import ConfiguracoesPage from '../pages/ConfiguracoesPage/ConfiguracoesPage';
import VendasPage from '../pages/VendasPage/VendasPage';
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

import AdminMetasPage from '../pages/AdminMetasPage/AdminMetasPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      
      <Route path="/funil" element={<PrivateRoute><FunilPage /></PrivateRoute>} />

      <Route path="/vendas" element={<PrivateRoute permission={['vendas', 'vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir']}><VendasPage /></PrivateRoute>} />

      <Route path="/login" element={<LoginPage />} />

      <Route path="/perfil" element={<PrivateRoute><PerfilPage /></PrivateRoute>} />

      <Route path="/perfil/editar" element={<PrivateRoute><EditarPerfilPage /></PrivateRoute>} />

      <Route
        path="/usuarios"
        element={<PrivateRoute permission={['crud_usuarios', 'usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'gerenciar_permissoes']}><Usuarios /></PrivateRoute>}
      />

      <Route
        path="/usuarios/novo"
        element={<PrivateRoute permission="usuarios_criar"><CadastroUsuario /></PrivateRoute>}
      />

      <Route
        path="/usuarios/cadastrar"
        element={<PrivateRoute permission="usuarios_criar"><CadastroUsuario /></PrivateRoute>}
      />

      <Route
        path="/usuarios/:id/editar"
        element={<PrivateRoute permission="usuarios_editar"><EditarUsuarioPage /></PrivateRoute>}
      />

      <Route
        path="/admin/metas"
        element={<PrivateRoute permission="gerenciar_metas"><AdminMetasPage /></PrivateRoute>}
      />

      <Route path="/retornos" element={<PrivateRoute><FunilPage /></PrivateRoute>} />
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/historico" element={<PrivateRoute><HistoricoPage /></PrivateRoute>} />
      <Route
        path="/configuracoes"
        element={<PrivateRoute permission={['crud_operadoras', 'crud_links', 'crud_tipos_venda', 'crud_servicos']}><ConfiguracoesPage /></PrivateRoute>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
