/**
 * Progresso dos cards de planilha: barra fina com percentual e uma linha de
 * resumo. Usado nos cards de Leads (admin) e Futuros Clientes.
 *
 * Quando `recusados > 0`, a barra fica segmentada: verde = trabalhados
 * positivos (futuros clientes/vendas), vermelho = clientes que recusaram.
 */
export default function DocProgresso({
  total,
  feitos,
  percentual,
  rotulo,
  rotuloCompleto,
  recusados = 0
}) {
  if (!total) return null;

  const completo = feitos >= total;
  const temRecusa = Number(recusados) > 0;
  const recusaPct = total ? Math.min(percentual, (recusados / total) * 100) : 0;
  const okPct = Math.max(0, percentual - recusaPct);
  // Ponto de corte verde/vermelho relativo a largura do fill (que ocupa `percentual`).
  const cortePct = percentual > 0 ? (okPct / percentual) * 100 : 0;
  const textoRecusa = Number(recusados) === 1 ? '1 recusou' : `${recusados} recusaram`;

  return (
    <div className="doc-progresso">
      <div className="doc-progresso__track" aria-hidden="true">
        <i
          className={`doc-progresso__fill ${temRecusa ? 'is-segmentado' : ''}`}
          style={{ width: `${percentual}%`, '--corte': `${cortePct}%` }}
        ></i>
      </div>
      <span className="doc-progresso__pct">{percentual}%</span>
      <span className={`doc-progresso__label ${completo ? 'is-completo' : ''}`}>
        {completo ? rotuloCompleto : `${feitos}/${total} ${rotulo}`}
        {temRecusa && <span className="doc-progresso__recusa"> · {textoRecusa}</span>}
      </span>
    </div>
  );
}
