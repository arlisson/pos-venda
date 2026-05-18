import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import * as I from '../../components/Icons';
import { buscarPerfil, getUsuarioLocal, logout, temPermissao } from '../../services/auth.service';
import VendaModal from '../../pages/VendasPage/VendaModal';
import ClienteModal from '../../pages/Clientes/ClienteModal';
import { listarClientesSelect } from '../../services/cliente.service';
import { listarOperadoras, listarServicos, listarTiposVenda } from '../../services/config.service';
import { criarVenda, listarAprovacoesVenda, listarVendedoras, obterReferenciasClientesVendas } from '../../services/venda.service';
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
  { path: '/clientes/:id/editar', title: 'Editar cliente', sub: 'Atualize dados do representante e fidelidade', id: 'clientes' },
  { path: '/funil', title: 'Funil de vendas', sub: 'Acompanhe cada venda do lançamento até a conclusão', id: 'funil' },
  { path: '/vendas/aprovacoes', title: 'Aprovações', sub: 'Solicitações de liberação ADM para vendas especiais', id: 'aprovacoes' },
  { path: '/retornos', title: 'Retornos', sub: 'Chips que retornaram por algum erro', id: 'retornos' },
  { path: '/relatorios', title: 'Relatórios', sub: 'Indicadores comerciais e desempenho por usuário', id: 'relatorios' },
  { path: '/historico', title: 'Histórico', sub: 'Todas as movimentações do sistema', id: 'historico' },
  { path: '/historico/lixeira', title: 'Lixeira de vendas', sub: 'Histórico das vendas excluídas', id: 'historico' },
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
  { path: '/futuros-clientes', title: 'Futuros Clientes', sub: 'Leads marcados para acompanhamento futuro', id: 'futuros-clientes', end: true },
];

function getRouteConfig(pathname) {
  return (
    routeConfigs.find(config =>
      matchPath({ path: config.path, end: config.end ?? true }, pathname)
    ) || { title: 'Sistema', sub: '', id: '' }
  );
}

function montarMapaReferencias(referencias = [], campo = 'total') {
  return referencias.reduce((mapa, item) => {
    if (item?.chave) mapa.set(item.chave, Number(item[campo] || 0));
    return mapa;
  }, new Map());
}

function LayoutPrivado({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState(() => getUsuarioLocal());
  const currentConfig = getRouteConfig(location.pathname);
  const podeCriarVenda = usuario && temPermissao(usuario, 'vendas_criar');
  const podeEditarVenda = usuario && temPermissao(usuario, ['vendas_editar', 'pos_venda']);
  const podeVerDocumentosVenda = usuario && temPermissao(usuario, 'vendas_documentos');
  const podeAdicionarDocumentosVenda = usuario && temPermissao(usuario, 'adicionar_documentos');
  const podeListarVendas = usuario && temPermissao(usuario, ['vendas_ver_proprias', 'vendas_ver_todas']);
  const podeListarClientes = usuario && temPermissao(usuario, ['clientes_ver_proprios', 'clientes_ver_todos']);
  const [novaVendaAberta, setNovaVendaAberta] = useState(false);
  const [carregandoNovaVenda, setCarregandoNovaVenda] = useState(false);
  const [erroNovaVenda, setErroNovaVenda] = useState('');
  const [sucessoNovaVenda, setSucessoNovaVenda] = useState('');
  const [clientesNovaVenda, setClientesNovaVenda] = useState([]);
  const [referenciasClientesNovaVenda, setReferenciasClientesNovaVenda] = useState([]);
  const [vendedorasNovaVenda, setVendedorasNovaVenda] = useState([]);
  const [operadorasNovaVenda, setOperadorasNovaVenda] = useState([]);
  const [tiposVendaNovaVenda, setTiposVendaNovaVenda] = useState([]);
  const [servicosNovaVenda, setServicosNovaVenda] = useState([]);
  const [clienteRapidoAberto, setClienteRapidoAberto] = useState(false);
  const [, setResolverClienteRapido] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const vendasPorClienteNovaVenda = useMemo(() => montarMapaReferencias(referenciasClientesNovaVenda, 'total'), [referenciasClientesNovaVenda]);
  const vendasEmAndamentoPorClienteNovaVenda = useMemo(() => montarMapaReferencias(referenciasClientesNovaVenda, 'em_andamento_total'), [referenciasClientesNovaVenda]);

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
    setMobileMenuOpen(false);
    logout();
    navigate('/login');
  }

  const handleSetPage = (id) => {
    const routeMap = {
      dashboard: '/',
      vendas: '/vendas',
      clientes: '/clientes',
      'futuros-clientes': '/futuros-clientes',
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

    if (routeMap[id]) {
      setMobileMenuOpen(false);
      navigate(routeMap[id]);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.toggle('mobile-menu-open', mobileMenuOpen);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('mobile-menu-open');
    };
  }, [mobileMenuOpen]);

  async function carregarDadosNovaVenda() {
    const [referenciasClientesData, clientesData, vendedorasData, operadorasData, tiposVendaData, servicosData] = await Promise.all([
      podeListarVendas ? obterReferenciasClientesVendas() : Promise.resolve([]),
      podeListarClientes ? listarClientesSelect() : Promise.resolve([]),
      listarVendedoras(),
      listarOperadoras(),
      listarTiposVenda(),
      listarServicos()
    ]);

    setReferenciasClientesNovaVenda(referenciasClientesData || []);
    setClientesNovaVenda(clientesData);
    setVendedorasNovaVenda(vendedorasData);
    setOperadorasNovaVenda(operadorasData);
    setTiposVendaNovaVenda(tiposVendaData);
    setServicosNovaVenda(servicosData);
  }

  async function handleNewSale() {
    if (!podeCriarVenda || carregandoNovaVenda) return;

    setErroNovaVenda('');
    setSucessoNovaVenda('');
    setCarregandoNovaVenda(true);

    try {
      await carregarDadosNovaVenda();
      setNovaVendaAberta(true);
    } catch (error) {
      setErroNovaVenda(error.message || 'Erro ao preparar cadastro de venda.');
    } finally {
      setCarregandoNovaVenda(false);
    }
  }

  async function salvarNovaVenda(dados) {
    setErroNovaVenda('');
    await criarVenda(dados);
    setNovaVendaAberta(false);
    setSucessoNovaVenda('Venda cadastrada com sucesso.');
    window.dispatchEvent(new CustomEvent('pos-venda:vendas-atualizadas'));
  }

  function abrirClienteRapido() {
    return new Promise(resolve => {
      setResolverClienteRapido(() => resolve);
      setClienteRapidoAberto(true);
    });
  }

  function fecharClienteRapido(cliente = null) {
    setClienteRapidoAberto(false);
    setResolverClienteRapido(resolve => {
      resolve?.(cliente);
      return null;
    });
  }

  async function salvarClienteRapido(clienteCriado) {
    const clientesAtualizados = podeListarClientes ? await listarClientesSelect() : [];
    setClientesNovaVenda(clientesAtualizados);
    fecharClienteRapido(clienteCriado);
    setSucessoNovaVenda('Cliente cadastrado com sucesso.');
    return clienteCriado;
  }

  const [alertasUrgentes, setAlertasUrgentes] = useState([]);
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState(0);
  const podeVerAprovacoes = usuario && temPermissao(usuario, 'vendas_aprovacoes_visualizar');

  useEffect(() => {
    if (!podeVerAprovacoes) {
      setAprovacoesPendentes(0);
      return undefined;
    }

    let ativo = true;

    async function carregar() {
      try {
        const lista = await listarAprovacoesVenda({ status: 'pendente' });
        if (!ativo) return;
        setAprovacoesPendentes(Array.isArray(lista) ? lista.length : 0);
      } catch {
        if (ativo) setAprovacoesPendentes(0);
      }
    }

    carregar();
    const timer = setInterval(carregar, 15000);

    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [podeVerAprovacoes]);

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

  function ocultarAlertaUrgente(notificacao) {
    const chave = notificacao.destinatario_id || notificacao.id;
    setAlertasUrgentes(prev => prev.filter(item => (item.destinatario_id || item.id) !== chave));
  }

  function confirmarPopupNotificacao(notificacao) {
    marcarPopupNotificacaoVisto(notificacao.id)
      .then(() => {
        window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
      })
      .catch(() => {});
  }

  function fecharAlertaUrgente(notificacao) {
    ocultarAlertaUrgente(notificacao);
    confirmarPopupNotificacao(notificacao);
  }

  function tomAlerta(notificacao) {
    switch (notificacao.tipo) {
      case 'venda_problema_aberto':
      case 'venda_problema_resolvido':
      case 'venda_problema_correcao':
        return 'info';
      case 'venda_retorno_registrado':
        return 'danger';
      case 'venda_aprovacao_pendente':
      case 'venda_parada_funil':
      case 'cliente_fidelidade':
        return 'warn';
      case 'nota_retorno_pre':
      case 'nota_retorno_due':
        return 'contact';
      default:
        return notificacao.nivel === 'warn' ? 'warn' : 'danger';
    }
  }

  function getDadosAlerta(notificacao) {
    if (!notificacao?.dados) return {};
    if (typeof notificacao.dados === 'string') {
      try {
        return JSON.parse(notificacao.dados) || {};
      } catch {
        return {};
      }
    }
    return notificacao.dados;
  }

  function montarRotaAlerta(notificacao) {
    const dados = getDadosAlerta(notificacao);
    const entidadeId = notificacao.entidade_id || dados.entidade_id || '';
    const vendaId = dados.venda_id || (notificacao.entidade === 'vendas' ? entidadeId : '') || entidadeId;
    const clienteId = dados.cliente_id || (notificacao.entidade === 'clientes' ? entidadeId : '');

    switch (notificacao.tipo) {
      case 'venda_problema_aberto':
      case 'venda_problema_resolvido':
      case 'venda_problema_correcao':
        return vendaId
          ? `/vendas?venda_id=${vendaId}&aba=problema${dados.problema_id ? `&problema_id=${dados.problema_id}` : ''}`
          : '/vendas';
      case 'venda_aprovacao_pendente':
        return '/vendas/aprovacoes';
      case 'venda_parada_funil':
        return '/funil';
      case 'venda_retorno_registrado':
        return vendaId ? `/retornos?venda_id=${vendaId}` : '/retornos';
      case 'cliente_fidelidade':
        return clienteId ? `/clientes/${clienteId}/editar` : '/clientes';
      case 'nota_retorno_pre':
      case 'nota_retorno_due':
        if (notificacao.entidade === 'clientes') {
          return clienteId ? `/clientes/${clienteId}/editar` : '/clientes';
        }
        return vendaId ? `/vendas?venda_id=${vendaId}` : '/vendas';
      default:
        if (notificacao.entidade === 'clientes') return clienteId ? `/clientes/${clienteId}/editar` : '/clientes';
        if (notificacao.entidade === 'vendas') return vendaId ? `/vendas?venda_id=${vendaId}` : '/vendas';
        return '/';
    }
  }

  function abrirVendaAlerta(notificacao) {
    const rota = montarRotaAlerta(notificacao);
    ocultarAlertaUrgente(notificacao);
    navigate(rota);
    confirmarPopupNotificacao(notificacao);
  }

  return (
    <div className={`app ${mobileMenuOpen ? 'is-mobile-menu-open' : ''}`}>
      <button
        type="button"
        className="sidebar-mobile-backdrop"
        aria-label="Fechar menu"
        onClick={() => setMobileMenuOpen(false)}
      />
      <Sidebar
        page={currentConfig.id}
        setPage={handleSetPage}
        counts={{ active: 0, returns: 0, aprovacoes: aprovacoesPendentes }}
        usuario={usuario}
        onLogout={handleLogout}
        isMobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onPerfilClick={() => {
          setMobileMenuOpen(false);
          navigate('/perfil');
        }}
      />
      <div className="main">
        <Header
          title={currentConfig.title}
          subtitle={currentConfig.sub}
          onNew={podeCriarVenda ? handleNewSale : null}
          usuario={usuario}
          onMenuClick={() => setMobileMenuOpen(open => !open)}
          mobileMenuOpen={mobileMenuOpen}
        />
        <div className="content">
          {sucessoNovaVenda && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucessoNovaVenda}</div>}
          {erroNovaVenda && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erroNovaVenda}</div>}
          {children}
        </div>
      </div>

      {podeCriarVenda && location.pathname === '/vendas' && (
        <button
          type="button"
          className="mobile-fab"
          aria-label="Nova venda"
          onClick={handleNewSale}
          disabled={carregandoNovaVenda}
        >
          <I.Plus size={22} />
        </button>
      )}

      {novaVendaAberta && (
        <VendaModal
          venda={null}
          clientes={clientesNovaVenda}
          vendas={[]}
          vendedoras={vendedorasNovaVenda}
          operadoras={operadorasNovaVenda}
          tiposVenda={tiposVendaNovaVenda}
          servicos={servicosNovaVenda}
          vendasPorCliente={vendasPorClienteNovaVenda}
          vendasEmAndamentoPorCliente={vendasEmAndamentoPorClienteNovaVenda}
          podeEditarVenda={podeEditarVenda}
          podeVerDocumentosVenda={podeVerDocumentosVenda}
          podeAdicionarDocumentosVenda={podeAdicionarDocumentosVenda}
          usuarioLogado={usuario}
          modoEdicao
          onClose={() => setNovaVendaAberta(false)}
          onSave={salvarNovaVenda}
          onSendToPosVenda={() => {}}
          onCreateClient={abrirClienteRapido}
        />
      )}

      {clienteRapidoAberto && (
        <ClienteModal
          cliente={null}
          operadoras={operadorasNovaVenda}
          onClose={() => fecharClienteRapido(null)}
          onSave={salvarClienteRapido}
        />
      )}

      {alertasUrgentes.length > 0 && (
        <div className="urgent-alert-stack" aria-live="assertive">
          {alertasUrgentes.map(alerta => (
            <div key={alerta.destinatario_id || alerta.id} className={`urgent-alert-card urgent-alert-card--${tomAlerta(alerta)}`}>
              <div className="urgent-alert-card__icon">
                <I.AlertTriangle size={18} />
              </div>
              <div className="urgent-alert-card__body">
                <strong>{alerta.titulo}</strong>
                <span>{alerta.mensagem}</span>
              </div>
              <div className="urgent-alert-card__actions">
                <button type="button" className="btn btn-sm" onClick={() => abrirVendaAlerta(alerta)}>
                  {alerta.entidade === 'clientes' ? 'Abrir cliente' : 'Abrir'}
                </button>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost urgent-alert-card__close"
                  onClick={() => fecharAlertaUrgente(alerta)}
                  title="Fechar aviso"
                  aria-label="Fechar aviso"
                >
                  <span className="urgent-alert-card__close-mark" aria-hidden="true">X</span>
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
