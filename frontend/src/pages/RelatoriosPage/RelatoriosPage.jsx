import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarVendedoras, obterRelatoriosVendas } from '../../services/venda.service';
import './RelatoriosPage.css';

const PERIODOS = [
  { value: 'mes_atual', label: 'Mes atual' },
  { value: 'ultimos_30_dias', label: 'Ultimos 30 dias' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana_atual', label: 'Semana atual' },
  { value: 'personalizado', label: 'Personalizado' }
];

const EMPTY_REPORT = {
  cards: {
    vendasAndamento: { quantidade: 0, valor: 0 },
    concluidas: { quantidade: 0, valor: 0 },
    perdaRetorno: { quantidade: 0, valor: 0, chips: 0 },
    taxaRetorno: { percentual: 0, chipsRetornados: 0, chipsVendidos: 0 }
  },
  porOperadora: [],
  rankingVendedores: []
};

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarPercentual(valor) {
  return `${Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function obterIniciais(nome = '') {
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0])
    .join('')
    .toUpperCase();

  return iniciais || '--';
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <article className={`relatorios-card ${tone ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function EmptyState({ children }) {
  return <div className="relatorios-empty">{children}</div>;
}

function RelatoriosPage() {
  const [periodo, setPeriodo] = useState('mes_atual');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vendedoraId, setVendedoraId] = useState('');
  const [vendedoras, setVendedoras] = useState([]);
  const [relatorio, setRelatorio] = useState(EMPTY_REPORT);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarVendedoras()
      .then(setVendedoras)
      .catch(error => setErro(error.message || 'Erro ao listar usuarios.'));
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarRelatorio() {
      setCarregando(true);
      setErro('');

      try {
        const filtros = {
          periodo,
          vendedora_id: vendedoraId
        };

        if (periodo === 'personalizado') {
          filtros.data_inicio = dataInicio;
          filtros.data_fim = dataFim;
        }

        const data = await obterRelatoriosVendas(filtros);

        if (ativo) {
          setRelatorio(data || EMPTY_REPORT);
        }
      } catch (error) {
        if (ativo) {
          setErro(error.message || 'Erro ao carregar relatorios.');
          setRelatorio(EMPTY_REPORT);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarRelatorio();

    return () => {
      ativo = false;
    };
  }, [periodo, dataInicio, dataFim, vendedoraId]);

  const maxOperadora = useMemo(() => (
    Math.max(...(relatorio.porOperadora || []).map(item => Number(item.valor || 0)), 0)
  ), [relatorio.porOperadora]);

  const maxRanking = useMemo(() => (
    Math.max(...(relatorio.rankingVendedores || []).map(item => Number(item.valor || 0)), 0)
  ), [relatorio.rankingVendedores]);

  const cards = relatorio.cards || EMPTY_REPORT.cards;
  const mostrarDatas = periodo === 'personalizado';

  return (
    <LayoutPrivado>
      <section className="relatorios-page">
        <div className="relatorios-toolbar">
          <label>
            <span>Periodo</span>
            <select value={periodo} onChange={event => setPeriodo(event.target.value)}>
              {PERIODOS.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          {mostrarDatas && (
            <>
              <label>
                <span>Inicio</span>
                <input type="date" value={dataInicio} onChange={event => setDataInicio(event.target.value)} />
              </label>
              <label>
                <span>Fim</span>
                <input type="date" value={dataFim} onChange={event => setDataFim(event.target.value)} />
              </label>
            </>
          )}

          <label>
            <span>Usuario</span>
            <select value={vendedoraId} onChange={event => setVendedoraId(event.target.value)}>
              <option value="">Todos</option>
              {vendedoras.map(usuario => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome || usuario.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        {erro && <div className="relatorios-alert">{erro}</div>}

        <div className="relatorios-cards">
          <MetricCard
            label="Vendas em andamento"
            value={cards.vendasAndamento.quantidade}
            detail={`${formatarMoeda(cards.vendasAndamento.valor)} em pipeline`}
          />
          <MetricCard
            label="Concluidas"
            value={formatarMoeda(cards.concluidas.valor)}
            detail={`${cards.concluidas.quantidade} vendas no periodo`}
          />
          <MetricCard
            label="Perda por retorno"
            value={formatarMoeda(cards.perdaRetorno.valor)}
            detail={`${cards.perdaRetorno.chips} chips retornaram`}
            tone="danger"
          />
          <MetricCard
            label="Taxa de retorno"
            value={formatarPercentual(cards.taxaRetorno.percentual)}
            detail={`${cards.taxaRetorno.chipsRetornados}/${cards.taxaRetorno.chipsVendidos} chips`}
          />
        </div>

        <div className="relatorios-grid">
          <section className="relatorios-panel">
            <div className="relatorios-panel-header">
              <h2>Por operadora</h2>
              {carregando && <span>Carregando...</span>}
            </div>
            {(relatorio.porOperadora || []).length === 0 ? (
              <EmptyState>Nenhuma venda encontrada no periodo.</EmptyState>
            ) : (
              <div className="relatorios-bars">
                {relatorio.porOperadora.map(item => {
                  const width = maxOperadora > 0 ? Math.max(4, (Number(item.valor || 0) / maxOperadora) * 100) : 0;

                  return (
                    <div className="relatorios-bar-row" key={item.id || item.nome}>
                      <span className="bar-label">{item.nome}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${width}%` }} />
                      </div>
                      <strong>{formatarMoeda(item.valor)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="relatorios-panel">
            <div className="relatorios-panel-header">
              <h2>Ranking de vendedores</h2>
              <span>{vendedoraId ? 'Usuario filtrado' : 'Todos os usuarios'}</span>
            </div>
            {(relatorio.rankingVendedores || []).length === 0 ? (
              <EmptyState>Nenhum desempenho encontrado.</EmptyState>
            ) : (
              <div className="relatorios-ranking">
                {relatorio.rankingVendedores.map(item => {
                  const width = maxRanking > 0 ? Math.max(4, (Number(item.valor || 0) / maxRanking) * 100) : 0;

                  return (
                    <div className="ranking-row" key={item.id || item.nome}>
                      <div className="ranking-person">
                        <span className="ranking-avatar">{obterIniciais(item.nome)}</span>
                        <div>
                          <strong>{item.nome}</strong>
                          {item.email && <small>{item.email}</small>}
                        </div>
                      </div>
                      <div className="ranking-bar">
                        <div style={{ width: `${width}%` }} />
                      </div>
                      <span>{formatarMoeda(item.valor)}</span>
                      <small>{item.vendas} vds</small>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>
    </LayoutPrivado>
  );
}

export default RelatoriosPage;
