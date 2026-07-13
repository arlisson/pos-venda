/**
 * Progresso dos cards de planilha: barra fina com percentual e uma linha de
 * resumo. Usado nos cards de Leads (admin) e Futuros Clientes.
 */
export default function DocProgresso({ total, feitos, percentual, rotulo, rotuloCompleto }) {
  if (!total) return null;

  const completo = feitos >= total;

  return (
    <div className="doc-progresso">
      <div className="doc-progresso__track" aria-hidden="true">
        <i style={{ '--progresso-envio': `${percentual}%` }}></i>
      </div>
      <span className="doc-progresso__pct">{percentual}%</span>
      <span className={`doc-progresso__label ${completo ? 'is-completo' : ''}`}>
        {completo ? rotuloCompleto : `${feitos}/${total} ${rotulo}`}
      </span>
    </div>
  );
}
