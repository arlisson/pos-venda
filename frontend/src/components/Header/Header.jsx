import React, { useEffect, useState } from 'react';
import * as I from '../Icons';
import { listarLinksExternos } from '../../services/config.service';

function Header({ title, subtitle, onNew }) {
  const [linksExternos, setLinksExternos] = useState([]);

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
          // Fallback conforme a imagem topbar.png se o banco estiver vazio
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

  return (
    <header className="header">
      <div className="header-info">
        <div className="header-title">{title}</div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>

      <div className="header-center">
        {linksExternos.length > 0 && (
          <div className="external-links">
            {linksExternos.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="external-link" title={`Abrir ${l.name}`}>
                <span className={`dot ${l.dot || 'gov'}`}></span>
                <span>{l.name}</span>
                <I.External size={11} style={{ opacity: 0.5 }} />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="header-actions">
        <div className="search-box">
          <I.Search size={14} style={{ color: 'var(--text-3)' }} />
          <input placeholder="Buscar venda, cliente, ICCID…" />
        </div>
        
        <button className="btn btn-icon btn-ghost btn-notification" title="Notificações">
          <I.Bell size={16} />
          <I.ChevronDown size={10} className="chevron" />
        </button>

        {onNew && (
          <button className="btn btn-primary btn-new-sale" onClick={onNew}>
            <I.Plus size={14} /> Nova venda
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
