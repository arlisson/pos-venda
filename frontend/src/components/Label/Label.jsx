import './Label.css';

/**
 * Retorna label no formato esperado pelo fluxo.
 */
function Label({ children }) {
  return <span className="label">{children}</span>;
}

export default Label;
