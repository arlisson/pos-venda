import React, { useId } from 'react';
import './Paginacao.css';

const OPCOES_POR_PAGINA = [20, 50, 100];

// Sempre retorna exatamente 7 slots — sem layout shift ao navegar.
// Slots são números ou as strings fixas 'ellipsis-start' / 'ellipsis-end'.
function gerarPaginas(total, atual) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (atual <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', total];
  }
  if (atual >= total - 3) {
    return [1, 'ellipsis-start', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis-start', atual - 1, atual, atual + 1, 'ellipsis-end', total];
}

function Paginacao({ total, paginaAtual, itensPorPagina, onPagina, onItensPorPagina }) {
  const uid = useId();
  const totalPaginas = Math.ceil(total / itensPorPagina);
  if (total === 0) return null;

  const inicio = (paginaAtual - 1) * itensPorPagina + 1;
  const fim = Math.min(paginaAtual * itensPorPagina, total);
  const paginas = gerarPaginas(totalPaginas, paginaAtual);

  return (
    <div className="paginacao">
      <span className="paginacao__info">
        {inicio}–{fim} de {total}
      </span>

      <div className="paginacao__nav-group">
        <button
          type="button"
          className="paginacao__nav"
          disabled={paginaAtual === 1}
          onClick={() => onPagina(paginaAtual - 1)}
          aria-label="Página anterior"
        >
          ‹
        </button>

        <div className="paginacao__grupo">
          {paginas.map(p =>
            typeof p === 'string' ? (
              <span key={p} className="paginacao__ellipsis">···</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`paginacao__btn${p === paginaAtual ? ' paginacao__btn--ativo' : ''}`}
                aria-current={p === paginaAtual ? 'page' : undefined}
                onClick={() => onPagina(p)}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="paginacao__nav"
          disabled={paginaAtual === totalPaginas}
          onClick={() => onPagina(paginaAtual + 1)}
          aria-label="Próxima página"
        >
          ›
        </button>
      </div>

      <div className="paginacao__por-pagina">
        <label htmlFor={`${uid}-pp`}>Por página</label>
        <select
          id={`${uid}-pp`}
          value={itensPorPagina}
          onChange={e => onItensPorPagina(Number(e.target.value))}
        >
          {OPCOES_POR_PAGINA.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default Paginacao;
