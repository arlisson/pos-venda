/**
 * Progresso dos cards de planilha: barra fina com percentual e uma linha de
 * resumo. Usado nos cards de Leads (admin) e Futuros Clientes.
 *
 * Quando `recusados > 0` e `segmentarBarra` esta ativo, a barra fica segmentada:
 * verde = trabalhados positivos (futuros clientes/vendas), vermelho = clientes
 * que recusaram. No admin a barra mede envios (outro denominador), entao
 * `segmentarBarra` fica desligado e os numeros aparecem apenas no resumo.
 */
export default function DocProgresso({
  total,
  feitos,
  percentual,
  rotulo,
  rotuloCompleto,
  recusados = 0,
  futuros = 0,
  segmentarBarra = true
}) {
  if (!total) return null;

  const completo = feitos >= total;
  const temRecusa = Number(recusados) > 0;
  const barraSegmentada = temRecusa && segmentarBarra;
  const temFuturos = Number(futuros) > 0;
  const recusaPct = total ? Math.min(percentual, (recusados / total) * 100) : 0;
  const okPct = Math.max(0, percentual - recusaPct);
  // Ponto de corte verde/vermelho relativo a largura do fill (que ocupa `percentual`).
  const cortePct = percentual > 0 ? (okPct / percentual) * 100 : 0;
  const capRecusa = Number(recusados) === 1 ? 'recusou' : 'recusaram';
  const capFuturos = Number(futuros) === 1 ? 'futuro cliente' : 'futuros clientes';

  return (
    <div className="doc-progresso">
      <div className="doc-progresso__track" aria-hidden="true">
        <i
          className={`doc-progresso__fill ${barraSegmentada ? 'is-segmentado' : ''}`}
          style={{ width: `${percentual}%`, '--corte': `${cortePct}%` }}
        ></i>
      </div>
      <span className="doc-progresso__pct">{percentual}%</span>
      <div className="doc-progresso__stats">
        <span className="doc-progresso__stat">
          <b className={`doc-progresso__num ${completo ? 'is-completo' : ''}`}>
            {completo ? rotuloCompleto : `${feitos}/${total}`}
          </b>
          {!completo && <em className="doc-progresso__cap">{rotulo}</em>}
        </span>
        {temFuturos && (
          <span className="doc-progresso__stat is-futuros">
            <b className="doc-progresso__num">{futuros}</b>
            <em className="doc-progresso__cap">{capFuturos}</em>
          </span>
        )}
        {temRecusa && (
          <span className="doc-progresso__stat is-recusa">
            <b className="doc-progresso__num">{recusados}</b>
            <em className="doc-progresso__cap">{capRecusa}</em>
          </span>
        )}
      </div>
    </div>
  );
}
