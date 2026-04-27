import React from 'react';
import * as I from '../Icons';
import { EXTERNAL_LINKS } from '../../config/constants';

function Header({ title, subtitle, onNew }) {
  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      <div className="external-links" style={{ marginLeft: 'auto' }}>
        {EXTERNAL_LINKS.map(l => (
          <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="external-link" title={`Abrir ${l.name}`}>
            <span className={`dot ${l.dot}`}></span>
            <span>{l.name}</span>
            <I.External size={11} style={{ opacity: 0.5 }} />
          </a>
        ))}
      </div>
      <div className="header-actions">
        <div className="search-box">
          <I.Search size={14} />
          <input placeholder="Buscar venda, cliente, ICCID…" />
        </div>
        <button className="btn btn-icon btn-ghost" title="Notificações">
          <I.Bell size={15} />
        </button>
        {onNew && (
          <button className="btn btn-primary" onClick={onNew}>
            <I.Plus size={14} /> Nova venda
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
