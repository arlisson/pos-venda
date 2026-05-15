import * as I from '../../components/Icons';

function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function somarColuna(linhas, campo) {
  return linhas.reduce((soma, linha) => soma + Number(linha[campo] || 0), 0);
}

function etapasDaSecao(linhas) {
  const mapa = new Map();

  linhas.forEach(linha => {
    (linha.etapas_funil || []).forEach(etapa => {
      if (!mapa.has(etapa.codigo)) {
        mapa.set(etapa.codigo, {
          ...etapa,
          vendas: 0,
          ugrs: 0
        });
      }

      const atual = mapa.get(etapa.codigo);
      atual.vendas += Number(etapa.vendas || 0);
      atual.ugrs += Number(etapa.ugrs || 0);
    });
  });

  return Array.from(mapa.values()).filter(etapa => etapa.vendas > 0 || etapa.ugrs > 0);
}

function EtapasResumo({ etapas }) {
  if (!etapas.length) return null;

  return (
    <div className="fechamento-etapas-resumo">
      <span className="fechamento-etapas-resumo__title">Etapas do funil</span>
      <div className="fechamento-etapas-resumo__grid">
        {etapas.map(etapa => (
          <div
            key={etapa.codigo}
            className={`fechamento-etapa-chip ${etapa.retorno ? 'is-return' : ''} ${etapa.etapa_final ? 'is-final' : ''}`}
          >
            <span>{etapa.nome}</span>
            <strong>{etapa.vendas}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function FechamentoSecao({ titulo, subtitulo, linhas = [], onDetalhes, secao, loading }) {
  const totais = {
    total_vendas: somarColuna(linhas, 'total_vendas'),
    contratos: somarColuna(linhas, 'contratos'),
    ugrs: somarColuna(linhas, 'ugrs'),
    movel: somarColuna(linhas, 'movel'),
    fixo: somarColuna(linhas, 'fixo'),
    internet: somarColuna(linhas, 'internet'),
    novo: somarColuna(linhas, 'novo'),
    portabilidade: somarColuna(linhas, 'portabilidade'),
    receita: somarColuna(linhas, 'receita')
  };
  const etapas = etapasDaSecao(linhas);

  return (
    <section className="fechamento-secao">
      <div className="fechamento-secao__header">
        <div className="fechamento-secao__title">
          <strong>{titulo}</strong>
          {subtitulo && <span>{subtitulo}</span>}
        </div>
        <div className="fechamento-secao__actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => onDetalhes(secao)}
            disabled={linhas.length === 0}
          >
            <I.Eye size={14} /> Detalhes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="fechamento-empty">Carregando...</div>
      ) : linhas.length === 0 ? (
        <div className="fechamento-empty">Nenhuma venda no período.</div>
      ) : (
        <>
          <EtapasResumo etapas={etapas} />
          <div className="fechamento-table-wrapper">
            <table className="fechamento-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Operadora</th>
                  <th rowSpan={2}>Total de vendas</th>
                  <th rowSpan={2}>Contratos Finalizados</th>
                  <th rowSpan={2}>UGRs</th>
                  <th colSpan={3} className="group-product">Produto</th>
                  <th colSpan={2} className="group-service">Serviço</th>
                  <th rowSpan={2}>Receita</th>
                </tr>
                <tr>
                  <th className="group-start">Movel</th>
                  <th>Fixo</th>
                  <th>Internet</th>
                  <th className="group-start">Novo</th>
                  <th>Portab.</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, idx) => (
                  <tr key={linha.operadora_id ?? `sem_${idx}`}>
                    <td>{linha.operadora_nome || 'Sem operadora'}</td>
                    <td>{linha.total_vendas}</td>
                    <td>{linha.contratos}</td>
                    <td>{linha.ugrs}</td>
                    <td>{linha.movel}</td>
                    <td>{linha.fixo}</td>
                    <td>{linha.internet}</td>
                    <td>{linha.novo}</td>
                    <td>{linha.portabilidade}</td>
                    <td>{fmtMoeda(linha.receita)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL</td>
                  <td>{totais.total_vendas}</td>
                  <td>{totais.contratos}</td>
                  <td>{totais.ugrs}</td>
                  <td>{totais.movel}</td>
                  <td>{totais.fixo}</td>
                  <td>{totais.internet}</td>
                  <td>{totais.novo}</td>
                  <td>{totais.portabilidade}</td>
                  <td>{fmtMoeda(totais.receita)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default FechamentoSecao;
