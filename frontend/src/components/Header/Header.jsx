import React, { useEffect, useRef, useState } from 'react';
import * as I from '../Icons';
import { listarLinksExternos } from '../../services/config.service';

function Header({ title, subtitle, onNew }) {
  const [linksExternos, setLinksExternos] = useState([]);
  const [linksOpen, setLinksOpen] = useState(false);
  const linksMenuRef = useRef(null);

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
      } catch (error) {
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
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-info">
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      <div className="header-actions">
        <div className="search-box">
          <I.Search size={14} style={{ color: 'var(--text-3)' }} />
          <input placeholder="Buscar venda, cliente, ICCID..." />
        </div>

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

        <button type="button" className="btn btn-icon btn-ghost btn-notification" title="Notificacoes">
          <I.Bell size={16} />
          <I.ChevronDown size={10} className="chevron" />
        </button>

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
