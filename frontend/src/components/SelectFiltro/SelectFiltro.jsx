import { useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SelectFiltro.css';

export default function SelectFiltro({
  value,
  onChange,
  options = [],
  placeholder = 'Todos',
  className = '',
  disabled = false,
  searchable = true,
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const buscaRef = useRef(null);

  const selecionada = options.find(op => String(op.value) === String(value));
  const labelAtual = selecionada ? selecionada.label : null;
  const termoBusca = normalizarBusca(buscaDeferred);
  const opcoesFiltradas = termoBusca
    ? options.filter(op => normalizarBusca(op.label).includes(termoBusca))
    : options;

  function calcularPosicao() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  useLayoutEffect(() => {
    if (aberto) calcularPosicao();
  }, [aberto]);

  useEffect(() => {
    if (aberto && searchable) buscaRef.current?.focus();
  }, [aberto, searchable]);

  useEffect(() => {
    if (!aberto) return;

    function fecharFora(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setAberto(false);
        setBusca('');
      }
    }

    document.addEventListener('mousedown', fecharFora);
    window.addEventListener('resize', calcularPosicao);
    window.addEventListener('scroll', calcularPosicao, true);

    return () => {
      document.removeEventListener('mousedown', fecharFora);
      window.removeEventListener('resize', calcularPosicao);
      window.removeEventListener('scroll', calcularPosicao, true);
    };
  }, [aberto]);

  function selecionar(val) {
    onChange(val);
    setAberto(false);
    setBusca('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setAberto(false);
      setBusca('');
    }
  }

  function alternarMenu() {
    if (aberto) setBusca('');
    setAberto(v => !v);
  }

  const wrapperClass = [`sf`, aberto ? 'sf--open' : '', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="sf__trigger"
        ref={triggerRef}
        disabled={disabled}
        onClick={alternarMenu}
      >
        <span className={`sf__valor ${!labelAtual ? 'sf__valor--vazio' : ''}`}>
          {labelAtual ?? placeholder}
        </span>
        <svg className="sf__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {aberto && createPortal(
        <div
          className="sf__menu"
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          onKeyDown={handleKeyDown}
        >
          {searchable && options.length > 0 && (
            <label className="sf__busca">
              <SearchIcon />
              <input
                ref={buscaRef}
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar"
                aria-label="Buscar filtro"
              />
            </label>
          )}
          <button
            type="button"
            className={`sf__opcao ${!value ? 'sf__opcao--ativa' : ''}`}
            onClick={() => selecionar('')}
          >
            <span>{placeholder}</span>
            {!value && <CheckIcon />}
          </button>
          <div className="sf__opcoes">
            {opcoesFiltradas.map(op => {
              const ativa = String(value) === String(op.value);
              return (
                <button
                  key={op.value}
                  type="button"
                  className={`sf__opcao ${ativa ? 'sf__opcao--ativa' : ''} ${op.disabled ? 'sf__opcao--disabled' : ''}`}
                  onClick={() => !op.disabled && selecionar(String(op.value))}
                  aria-disabled={op.disabled ? 'true' : undefined}
                >
                  <span>{op.label}</span>
                  {ativa && <CheckIcon />}
                </button>
              );
            })}
            {opcoesFiltradas.length === 0 && (
              <div className="sf__vazio">Nenhuma opcao encontrada</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
