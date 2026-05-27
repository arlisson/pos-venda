import { useState, useEffect } from 'react';

/**
 * Retorna uma versao atrasada de um valor para reduzir atualizacoes frequentes.
 *
 * @template T
 * @param {T} value - Valor original.
 * @param {number} delay - Atraso em milissegundos.
 * @returns {T} Valor atualizado somente apos o atraso.
 */
export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
