import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../Icons';
import { listarLinksExternos } from '../../services/config.service';
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas
} from '../../services/notificacao.service';
import { temPermissao } from '../../services/auth.service';

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getNotificationTarget(notification) {
  if (notification.tipo === 'cliente_fidelidade') {
    return Number(notification.dados?.dias_restantes ?? 1) < 0
      ? '/clientes?fidelidade=vencida'
      : '/clientes?fidelidade=alerta';
  }

  if (notification.entidade === 'clientes') {
    if (notification.tipo === 'nota_retorno_due') {
      return '/clientes?retorno=vencido';
    }

    const clienteId = notification.entidade_id || notification.dados?.entidade_id;
    return clienteId ? `/clientes?cliente_id=${clienteId}&highlight=${clienteId}` : '/clientes';
  }

  if (notification.entidade === 'vendas') {
    const vendaId = notification.entidade_id || notification.dados?.venda_id;
    return vendaId ? `/vendas?venda_id=${vendaId}` : '/vendas';
  }

  return null;
}

function Header({ title, subtitle, onNew, usuario }) {
  const navigate = useNavigate();
  const [linksExternos, setLinksExternos] = useState([]);
  const [linksOpen, setLinksOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const linksMenuRef = useRef(null);
  const notificationsMenuRef = useRef(null);
  const podeVerNotificacoes = Boolean(usuario) || temPermissao(usuario, 'notificacoes_visualizar');

  useEffect(() => {
    async function carregarLinks() {
      try {
        const dados = await listarLinksExternos();
        if (Array.isArray(dados) && dados.length > 0) {
          setLinksExternos(dados.map(link => ({
            id: link.chave || link.id,
            name: link.nome,
            url: link.url,
            dot: link.dot
          })));
        } else {
          setLinksExternos([
            { id: 'gov', name: 'Receita Federal', url: 'https://www.gov.br/receitafederal/', dot: 'gov' },
            { id: 'vivo', name: 'Vivo Empresas', url: 'https://www.vivo.com.br/empresas/', dot: 'vivo' },
            { id: 'tim', name: 'TIM Empresas', url: 'https://www.tim.com.br/empresas/', dot: 'tim' },
            { id: 'claro', name: 'Claro Empresas', url: 'https://www.claro.com.br/empresas/', dot: 'claro' },
          ]);
        }
      } catch {
        setLinksExternos([]);
      }
    }

    carregarLinks();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (linksMenuRef.current && !linksMenuRef.current.contains(event.target)) {
        setLinksOpen(false);
      }

      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function carregarNotificacoes() {
    try {
      const dados = await listarNotificacoes({ limit: 8 });
      setNotifications(dados.notificacoes || []);
      setUnreadCount(Number(dados.unread_count || 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!podeVerNotificacoes) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    carregarNotificacoes();
  }, [podeVerNotificacoes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!podeVerNotificacoes) return undefined;

    function handleRefreshNotifications() {
      carregarNotificacoes();
    }

    window.addEventListener('pos-venda:notificacoes-atualizar', handleRefreshNotifications);
    return () => window.removeEventListener('pos-venda:notificacoes-atualizar', handleRefreshNotifications);
  }, [podeVerNotificacoes]);

  async function handleOpenNotifications() {
    setNotificationsOpen(open => !open);

    if (!notificationsOpen) {
      await carregarNotificacoes();
    }
  }

  async function handleMarkRead(notification) {
    if (!notification.lida) {
      await marcarNotificacaoLida(notification.id);
      await carregarNotificacoes();
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    }

    const target = getNotificationTarget(notification);

    if (target) {
      setNotificationsOpen(false);
      navigate(target);
    }
  }

  async function handleMarkAllRead() {
    await marcarTodasNotificacoesLidas();
    await carregarNotificacoes();
    window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
  }

  return (
    <header className="header">
      <div className="header-info">
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      <div className="header-actions">
        

        {linksExternos.length > 0 && (
          <div className="external-links-menu" ref={linksMenuRef}>
            <button
              type="button"
              className="btn btn-secondary btn-links"
              onClick={() => setLinksOpen(open => !open)}
              aria-expanded={linksOpen}
              aria-haspopup="menu"
            >
              <I.External size={14} />
              <span>Links uteis</span>
              <I.ChevronDown size={12} className={`chevron ${linksOpen ? 'is-open' : ''}`} />
            </button>

            {linksOpen && (
              <div className="external-links-popover" role="menu">
                {linksExternos.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                    title={`Abrir ${link.name}`}
                    role="menuitem"
                    onClick={() => setLinksOpen(false)}
                  >
                    <span className={`dot ${link.dot || 'gov'}`}></span>
                    <span>{link.name}</span>
                    <I.External size={11} style={{ opacity: 0.5 }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {podeVerNotificacoes && (
        <div className="notification-menu" ref={notificationsMenuRef}>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-notification"
            title="Notificacoes"
            onClick={handleOpenNotifications}
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
          >
            <span className="notification-bell">
              <I.Bell size={16} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </span>
            <I.ChevronDown size={10} className={`chevron ${notificationsOpen ? 'is-open' : ''}`} />
          </button>

          {notificationsOpen && (
            <div className="notification-popover" role="menu">
              <div className="notification-popover__header">
                <strong>Notificacoes</strong>
                {unreadCount > 0 && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={handleMarkAllRead}>
                    Marcar lidas
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="notification-empty">Nenhuma notificacao ativa.</div>
              ) : (
                notifications.map(notification => (
                  <button
                    type="button"
                    key={notification.destinatario_id || notification.id}
                    className={`notification-item ${notification.lida ? '' : 'is-unread'} ${notification.nivel || 'info'}`}
                    onClick={() => handleMarkRead(notification)}
                    role="menuitem"
                  >
                    <span className="notification-dot"></span>
                    <span className="notification-item__body">
                      <strong>{notification.titulo}</strong>
                      <span>{notification.mensagem}</span>
                      <em>{formatDate(notification.dados?.fidelidade_fim || notification.dados?.retorno_agendado_para || notification.updated_at)}</em>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        )}

        {onNew && (
          <button type="button" className="btn btn-primary btn-new-sale" onClick={onNew}>
            <I.Plus size={14} /> Nova venda
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
