import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import * as I from '../../components/Icons';
import { buscarPerfil, getUsuarioLocal, logout } from '../../services/auth.service';
import {
  listarNotificacoesUrgentes,
  marcarPopupNotificacaoVisto
} from '../../services/notificacao.service';

const routeConfigs = [
  { path: '/', title: 'Dashboard', sub: 'Indicadores, campanhas e gamificação', id: 'dashboard', end: true },
  { path: '/vendas', title: 'Vendas', sub: 'Cadastro manual das vendas fechadas', id: 'vendas' },
  { path: '/vendas/lixeira', title: 'Lixeira de vendas', sub: 'Vendas removidas e prazo de exclusão definitiva', id: 'vendas' },
  { path: '/clientes', title: 'Clientes', sub: 'Representantes e empresas vinculados as vendas', id: 'clientes', end: true },
  { path: '/clientes/lixeira', title: 'Lixeira de clientes', sub: 'Clientes removidos e prazo de exclusão definitiva', id: 'clientes' },
  { path: '/clientes/novo', title: 'Novo cliente', sub: 'Cadastrar representante de empresa', id: 'clientes' },
  { path: '/clientes/:id/editar', title: 'Editar cliente', sub: 'Atualize dados do representante e fidelidade', id: 'clientes' },
  { path: '/funil', title: 'Funil de vendas', sub: 'Acompanhe cada venda do lançamento até a conclusão', id: 'funil' },
  { path: '/vendas/aprovacoes', title: 'Aprovações', sub: 'Solicitações de liberação ADM para vendas especiais', id: 'aprovacoes' },
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
  { path: '/admin/campanhas', title: 'Campanhas', sub: 'Configure desafios e recompensas do time', id: 'campanhas' },
  { path: '/admin/fechamento-mensal', title: 'Fechamento Mensal', sub: 'Consolide contratos, UGRs e comissões do período', id: 'fechamento-mensal' },
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
      aprovacoes: '/vendas/aprovacoes',
      retornos: '/retornos',
      relatorios: '/relatorios',
      historico: '/historico',
      usuarios: '/usuarios',
      config: '/configuracoes',
      campanhas: '/admin/campanhas',
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

  const [alertasUrgentes, setAlertasUrgentes] = useState([]);

  async function carregarAlertasUrgentes() {
    try {
      const dados = await listarNotificacoesUrgentes();
      setAlertasUrgentes(dados.notificacoes || []);
    } catch {
      setAlertasUrgentes([]);
    }
  }

  useEffect(() => {
    if (!usuario) return undefined;

    carregarAlertasUrgentes();
    const timer = setInterval(carregarAlertasUrgentes, 5000);

    return () => clearInterval(timer);
  }, [usuario?.id]);

  async function fecharAlertaUrgente(notificacao) {
    await marcarPopupNotificacaoVisto(notificacao.id);
    setAlertasUrgentes(prev => prev.filter(item => item.id !== notificacao.id));
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
  }

  async function abrirVendaAlerta(notificacao) {
    await fecharAlertaUrgente(notificacao);
    navigate(`/vendas?venda_id=${notificacao.entidade_id || notificacao.dados?.venda_id || ''}&aba=problema`);
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

      {alertasUrgentes.length > 0 && (
        <div className="urgent-alert-stack" aria-live="assertive">
          {alertasUrgentes.map(alerta => (
            <div key={alerta.destinatario_id || alerta.id} className={`urgent-alert-card ${alerta.nivel || 'danger'}`}>
              <div className="urgent-alert-card__icon">
                <I.AlertTriangle size={18} />
              </div>
              <div className="urgent-alert-card__body">
                <strong>{alerta.titulo}</strong>
                <span>{alerta.mensagem}</span>
              </div>
              <div className="urgent-alert-card__actions">
                <button type="button" className="btn btn-sm" onClick={() => abrirVendaAlerta(alerta)}>
                  Abrir venda
                </button>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => fecharAlertaUrgente(alerta)} title="Fechar aviso">
                  <I.Close size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LayoutPrivado;
