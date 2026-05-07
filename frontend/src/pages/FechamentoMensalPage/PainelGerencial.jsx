function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const INDICADORES = [
  { key: 'total_vendas', label: 'Vendas' },
  { key: 'tratando', label: 'Tratando' },
  { key: 'ativas', label: 'Ativas' },
  { key: 'retornos', label: 'Retorno' },
  { key: 'ugrs_total', label: 'UGRs' },
  { key: 'portabilidade', label: 'Port.' },
  { key: 'net_add', label: 'Net add', destaque: true }
];

function PainelGerencial({ linhas = [], loading }) {
  return (
    <section className="fechamento-painel">
      <div className="fechamento-painel__header">
        <div>
          <strong>Painel gerencial</strong>
          <span>Resumo operacional por categoria, calculado com os dados atuais das vendas.</span>
        </div>
      </div>

      {loading ? (
        <div className="fechamento-empty">Carregando painel...</div>
      ) : linhas.length === 0 ? (
        <div className="fechamento-empty">Nenhum dado para o painel no período.</div>
      ) : (
        <div className="fechamento-painel__grid">
          {linhas.map(linha => (
            <article key={linha.categoria} className={`fechamento-painel-card categoria-${linha.categoria}`}>
              <div className="fechamento-painel-card__top">
                <strong>{linha.label}</strong>
                <span>{fmtMoeda(linha.receita)}</span>
              </div>

              <div className="fechamento-painel-card__metrics">
                {INDICADORES.map(item => (
                  <div key={item.key} className={item.destaque ? 'is-highlight' : ''}>
                    <span>{item.label}</span>
                    <strong>{linha[item.key] ?? 0}</strong>
                  </div>
                ))}
              </div>

              <div className="fechamento-painel-card__funil">
                <div className="fechamento-painel-card__funil-title">Etapas do funil</div>
                {(linha.etapas_funil || []).map(etapa => (
                  <div
                    key={etapa.codigo}
                    className={`fechamento-painel-card__etapa ${etapa.retorno ? 'is-return' : ''} ${etapa.etapa_final ? 'is-final' : ''}`}
                  >
                    <span>{etapa.nome}</span>
                    <strong>{etapa.vendas}</strong>
                  </div>
                ))}
              </div>

              <div className="fechamento-painel-card__footer">
                <span>Comissão estimada</span>
                <strong>{fmtMoeda(linha.comissao_estimada)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default PainelGerencial;
