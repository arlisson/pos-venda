import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { getUsuarioLocal, logout } from '../../services/auth.service';

function LayoutPrivado({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = getUsuarioLocal();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const routeConfig = {
    '/': { title: 'Funil de vendas', sub: 'Acompanhe cada venda do lançamento até a conclusão', id: 'funil' },
    '/retornos': { title: 'Retornos', sub: 'Chips que retornaram por algum erro', id: 'retornos' },
    '/dashboard': { title: 'Relatórios', sub: 'Indicadores e produtividade', id: 'dashboard' },
    '/historico': { title: 'Histórico', sub: 'Todas as movimentações do sistema', id: 'historico' },
    '/usuarios': { title: 'Usuários', sub: 'Gerencie acessos e permissões', id: 'usuarios' },
    '/usuarios/novo': { title: 'Novo Usuário', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
    '/perfil': { title: 'Meu Perfil', sub: 'Gerencie seus dados e permissões', id: 'perfil' },
    '/configuracoes': { title: 'Configuracoes', sub: 'Gerencie operadoras e links externos', id: 'config' },
  };

  const currentConfig = routeConfig[location.pathname] || { title: 'Sistema', sub: '', id: '' };

  const handleSetPage = (id) => {
    const routeMap = {
      'funil': '/',
      'retornos': '/retornos',
      'dashboard': '/dashboard',
      'historico': '/historico',
      'usuarios': '/usuarios',
      'config': '/configuracoes',
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
          onNew={currentConfig.id === 'funil' ? () => navigate('/usuarios/novo') : null}
        />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutPrivado;
