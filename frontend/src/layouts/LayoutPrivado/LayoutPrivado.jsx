import React from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { getUsuarioLocal, logout } from '../../services/auth.service';

const routeConfigs = [
  { path: '/', title: 'Dashboard', sub: 'Indicadores, metas e gamificação', id: 'dashboard', end: true },
  { path: '/funil', title: 'Funil de vendas', sub: 'Acompanhe cada venda do lançamento até a conclusão', id: 'funil' },
  { path: '/retornos', title: 'Retornos', sub: 'Chips que retornaram por algum erro', id: 'retornos' },
  { path: '/historico', title: 'Histórico', sub: 'Todas as movimentações do sistema', id: 'historico' },
  { path: '/usuarios', title: 'Usuários', sub: 'Gerencie acessos e permissões', id: 'usuarios', end: true },
  { path: '/usuarios/novo', title: 'Novo Usuário', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/cadastrar', title: 'Novo Usuário', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/:id/editar', title: 'Editar Usuário', sub: 'Atualize dados, status e permissões', id: 'usuarios' },
  { path: '/perfil', title: 'Perfil', sub: 'Suas informações de conta e acesso', id: 'perfil', end: true },
  { path: '/perfil/editar', title: 'Editar perfil', sub: 'Atualize seus dados de acesso', id: 'perfil' },
  { path: '/configuracoes', title: 'Configurações', sub: 'Gerencie operadoras e links externos', id: 'config' },
  { path: '/admin/metas', title: 'Metas', sub: 'Configure desafios e recompensas do time', id: 'metas' },
];

function getRouteConfig(pathname) {
  return (
    routeConfigs.find(config =>
      matchPath({ path: config.path, end: config.end ?? true }, pathname)
    ) || { title: 'Sistema', sub: '', id: '' }
  );
}

function LayoutPrivado({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = getUsuarioLocal();
  const currentConfig = getRouteConfig(location.pathname);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const handleSetPage = (id) => {
    const routeMap = {
      dashboard: '/',
      funil: '/funil',
      retornos: '/retornos',
      historico: '/historico',
      usuarios: '/usuarios',
      config: '/configuracoes',
      metas: '/admin/metas',
    };
    if (routeMap[id]) navigate(routeMap[id]);
  };

  return (
    <div className="app">
      <Sidebar
        page={currentConfig.id}
        setPage={handleSetPage}
        counts={{ active: 0, returns: 0 }}
        usuario={usuario}
        onLogout={handleLogout}
        onPerfilClick={() => navigate('/perfil')}
      />
      <div className="main">
        <Header
          title={currentConfig.title}
          subtitle={currentConfig.sub}
          onNew={() => navigate('/usuarios/novo')}
        />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutPrivado;
