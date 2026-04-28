import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { getUsuarioLocal, logout } from '../../services/auth.service';

const routeConfigs = [
  { path: '/', title: 'Dashboard', sub: 'Indicadores, metas e gamificacao', id: 'dashboard', end: true },
  { path: '/vendas', title: 'Vendas', sub: 'Cadastro manual das vendas fechadas', id: 'vendas' },
  { path: '/clientes', title: 'Clientes', sub: 'Representantes e empresas vinculados as vendas', id: 'clientes', end: true },
  { path: '/clientes/novo', title: 'Novo cliente', sub: 'Cadastrar representante de empresa', id: 'clientes' },
  { path: '/clientes/:id/editar', title: 'Editar cliente', sub: 'Atualize dados do representante e fidelidade', id: 'clientes' },
  { path: '/funil', title: 'Funil de vendas', sub: 'Acompanhe cada venda do lancamento ate a conclusao', id: 'funil' },
  { path: '/retornos', title: 'Retornos', sub: 'Chips que retornaram por algum erro', id: 'retornos' },
  { path: '/historico', title: 'Historico', sub: 'Todas as movimentacoes do sistema', id: 'historico' },
  { path: '/usuarios', title: 'Usuarios', sub: 'Gerencie acessos e permissoes', id: 'usuarios', end: true },
  { path: '/usuarios/novo', title: 'Novo Usuario', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/cadastrar', title: 'Novo Usuario', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/:id/editar', title: 'Editar Usuario', sub: 'Atualize dados, status e permissoes', id: 'usuarios' },
  { path: '/perfil', title: 'Perfil', sub: 'Suas informacoes de conta e acesso', id: 'perfil', end: true },
  { path: '/perfil/editar', title: 'Editar perfil', sub: 'Atualize seus dados de acesso', id: 'perfil' },
  { path: '/configuracoes', title: 'Configuracoes', sub: 'Gerencie operadoras, tipos de venda, servicos e links externos', id: 'config' },
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
      vendas: '/vendas',
      clientes: '/clientes',
      funil: '/funil',
      retornos: '/retornos',
      historico: '/historico',
      usuarios: '/usuarios',
      config: '/configuracoes',
      metas: '/admin/metas',
    };

    if (routeMap[id]) navigate(routeMap[id]);
  };

  function handleNewSale() {
    if (location.pathname === '/vendas') {
      window.dispatchEvent(new CustomEvent('pos-venda:nova-venda'));
      return;
    }

    navigate('/vendas?nova=1');
  }

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
          onNew={handleNewSale}
        />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutPrivado;
