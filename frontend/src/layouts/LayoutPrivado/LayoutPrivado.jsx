import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { buscarPerfil, getUsuarioLocal, logout } from '../../services/auth.service';

const routeConfigs = [
  { path: '/', title: 'Dashboard', sub: 'Indicadores, metas e gamificação', id: 'dashboard', end: true },
  { path: '/vendas', title: 'Vendas', sub: 'Cadastro manual das vendas fechadas', id: 'vendas' },
  { path: '/vendas/lixeira', title: 'Lixeira de vendas', sub: 'Vendas removidas e prazo de exclusão definitiva', id: 'vendas' },
  { path: '/clientes', title: 'Clientes', sub: 'Representantes e empresas vinculados as vendas', id: 'clientes', end: true },
  { path: '/clientes/lixeira', title: 'Lixeira de clientes', sub: 'Clientes removidos e prazo de exclusão definitiva', id: 'clientes' },
  { path: '/clientes/novo', title: 'Novo cliente', sub: 'Cadastrar representante de empresa', id: 'clientes' },
  { path: '/clientes/:id/editar', title: 'Editar cliente', sub: 'Atualize dados do representante e fidelidade', id: 'clientes' },
  { path: '/funil', title: 'Funil de vendas', sub: 'Acompanhe cada venda do lancamento ate a conclusao', id: 'funil' },
  { path: '/retornos', title: 'Retornos', sub: 'Chips que retornaram por algum erro', id: 'retornos' },
  { path: '/relatorios', title: 'Relatórios', sub: 'Indicadores comerciais e desempenho por usuário', id: 'relatorios' },
  { path: '/historico', title: 'Histórico', sub: 'Todas as movimentações do sistema', id: 'historico' },
  { path: '/usuarios', title: 'Usuários', sub: 'Gerencie acessos e permissões', id: 'usuarios', end: true },
  { path: '/usuarios/novo', title: 'Novo Usuário', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/cadastrar', title: 'Novo Usuário', sub: 'Cadastrar novo acesso no sistema', id: 'usuarios' },
  { path: '/usuarios/:id/editar', title: 'Editar Usuário', sub: 'Atualize dados, status e permissões', id: 'usuarios' },
  { path: '/perfil', title: 'Perfil', sub: 'Suas informações de conta e acesso', id: 'perfil', end: true },
  { path: '/perfil/editar', title: 'Editar perfil', sub: 'Atualize seus dados de acesso', id: 'perfil' },
  { path: '/configuracoes', title: 'Configurações', sub: 'Gerencie operadoras, tipos de venda, serviços e links externos', id: 'config' },
  { path: '/admin/metas', title: 'Metas', sub: 'Configure desafios e recompensas do time', id: 'metas' },
  { path: '/admin/fechamento-mensal', title: 'Fechamento Mensal', sub: 'Consolide contratos, UGRs e comissoes do periodo', id: 'fechamento-mensal' },
  { path: '/admin/leads', title: 'Planilhas de leads', sub: 'Importe, filtre e distribua leads para vendedores', id: 'leads' },
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
  const [usuario, setUsuario] = useState(() => getUsuarioLocal());
  const currentConfig = getRouteConfig(location.pathname);

  useEffect(() => {
    let ativo = true;

    buscarPerfil()
      .then(usuarioAtualizado => {
        if (!ativo) return;
        localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
        setUsuario(usuarioAtualizado);
      })
      .catch(() => {});

    return () => {
      ativo = false;
    };
  }, []);

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
      relatorios: '/relatorios',
      historico: '/historico',
      usuarios: '/usuarios',
      config: '/configuracoes',
      metas: '/admin/metas',
      'fechamento-mensal': '/admin/fechamento-mensal',
      leads: '/admin/leads',
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
          usuario={usuario}
        />
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default LayoutPrivado;
