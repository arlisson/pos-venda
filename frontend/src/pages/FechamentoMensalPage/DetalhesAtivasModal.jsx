import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import { getDetalhesChips } from '../../services/fechamento.service';

const DADOS_VAZIOS = {
  linhas: [],
  totais_por_vendedora: [],
  total_geral: {
    chips: 0,
    valor: 0,
    comissao: 0,
    ugrs_sem_regra: 0
  }
};

function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(valor) {
  if (!valor) return '-';
  const iso = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function fmtRegra(regra) {
  if (!regra) return 'Sem regra';
  return `${fmtMoeda(regra.valor_min)} até ${fmtMoeda(regra.valor_max)}`;
}

function fmtRepasse(linha) {
  return linha.cliente_base_operadora ? 'Base da operadora' : 'Cliente novo/portabilidade';
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function valoresBuscaLinha(linha) {
  return [
    linha.venda_id,
    `#${linha.venda_id}`,
    linha.chip_index,
    linha.numero_ativado,
    linha.data_ativacao,
    fmtData(linha.data_ativacao),
    linha.data_venda,
    fmtData(linha.data_venda),
    linha.vendedora?.nome,
    linha.vendedora?.email,
    linha.cliente?.nome,
    linha.cliente?.razao_social,
    linha.cliente?.cnpj,
    linha.cliente?.fidelidade_fim,
    linha.cliente?.operadora_atual?.nome,
    linha.operadora?.nome,
    fmtRepasse(linha),
    linha.tipo_venda,
    linha.servico,
    linha.ddd,
    linha.gb,
    linha.valor_unitario,
    fmtMoeda(linha.valor_unitario),
    linha.regra_comissao?.valor_min,
    linha.regra_comissao?.valor_max,
    fmtRegra(linha.regra_comissao),
    linha.comissao_integral,
    linha.comissao_base,
    linha.comissao,
    fmtMoeda(linha.comissao)
  ].map(valor => normalizarBusca(valor)).join(' ');
}

function calcularTotais(linhas) {
  const totaisVendedora = new Map();

  linhas.forEach(linha => {
    if (linha.comissao === null || !linha.vendedora) return;
    const chave = linha.vendedora.id || 'sem_vendedora';
    const atual = totaisVendedora.get(chave) || {
      vendedora_id: linha.vendedora.id || null,
      vendedora_nome: linha.vendedora.nome || 'Sem vendedora',
      total_ugrs: 0,
      total_comissao: 0
    };

    atual.total_ugrs += 1;
    atual.total_comissao += Number(linha.comissao || 0);
    totaisVendedora.set(chave, atual);
  });

  return {
    totais_por_vendedora: Array.from(totaisVendedora.values())
      .map(item => ({ ...item, total_comissao: Number(item.total_comissao.toFixed(2)) }))
      .sort((a, b) => b.total_comissao - a.total_comissao),
    total_geral: {
      chips: linhas.length,
      valor: Number(linhas.reduce((soma, linha) => soma + Number(linha.valor_unitario || 0), 0).toFixed(2)),
      comissao: Number(linhas.reduce((soma, linha) => soma + Number(linha.comissao || 0), 0).toFixed(2)),
      ugrs_sem_regra: linhas.filter(linha => linha.sem_regra).length
    }
  };
}

function DetalhesAtivasModal({ secao = 'ativas', periodo, onClose }) {
  const navigate = useNavigate();
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);

    getDetalhesChips({ secao, ...periodo })
      .then(resp => {
        if (!ativo) return;
        setDados({
          ...DADOS_VAZIOS,
          ...(resp || {}),
          total_geral: {
            ...DADOS_VAZIOS.total_geral,
            ...(resp?.total_geral || {})
          }
        });
      })
      .catch(err => {
        if (!ativo) return;
        setErro(err?.message || 'Erro ao carregar detalhes por chip.');
      })
      .finally(() => {
        if (!ativo) return;
        setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [secao, periodo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const linhasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    if (!termo) return linhas;
    return linhas.filter(linha => valoresBuscaLinha(linha).includes(termo));
  }, [busca, dados.linhas]);

  const totaisFiltrados = useMemo(() => calcularTotais(linhasFiltradas), [linhasFiltradas]);
  const totalGeral = totaisFiltrados.total_geral;
  const totaisPorVendedora = totaisFiltrados.totais_por_vendedora;
  const titulosSecao = {
    total: 'Detalhes - Total de vendas (linha por UGR)',
    tratando: 'Detalhes - Contratos tratando (linha por UGR)',
    ativas: 'Detalhes - Vendas ativas (linha por UGR)'
  };

  function abrirVenda(vendaId) {
    if (!vendaId) return;
    onClose?.();
    navigate(`/vendas?venda_id=${vendaId}`);
  }

  function handleLinhaKeyDown(event, vendaId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirVenda(vendaId);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fechamento-modal-large" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{titulosSecao[secao] || 'Detalhes - linha por UGR'}</div>
              <div className="modal-sub">
                {linhasFiltradas.length} de {dados.linhas.length} UGR(s) - Comissão total: {fmtMoeda(totalGeral.comissao)}
                {totalGeral.ugrs_sem_regra > 0 && (
                  <span className="fechamento-pendencia">
                    {totalGeral.ugrs_sem_regra} sem regra
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="btn-icon btn-ghost" onClick={onClose} aria-label="Fechar">
              <I.Close size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {erro && <div className="alert-error" style={{ margin: 16 }}>{erro}</div>}
          {loading ? (
            <div className="fechamento-empty">Carregando...</div>
          ) : dados.linhas.length === 0 ? (
            <div className="fechamento-empty">Nenhum chip no periodo.</div>
          ) : (
            <>
              <div className="fechamento-modal-search">
                <input
                  type="search"
                  value={busca}
                  onChange={event => setBusca(event.target.value)}
                  placeholder="Buscar em todos os campos"
                />
              </div>
              {linhasFiltradas.length === 0 ? (
                <div className="fechamento-empty">Nenhum resultado para a busca.</div>
              ) : (
              <div className="fechamento-modal-table-wrapper">
                <table className="fechamento-modal-table">
                  <thead>
                    <tr>
                      <th>Venda</th>
                      <th>Ativacao</th>
                      <th>Venda</th>
                      <th>Vendedora</th>
                      <th>Cliente</th>
                      <th>CNPJ</th>
                      <th>Operadora</th>
                      <th>Operadora atual</th>
                      <th>Repasse</th>
                      <th>Tipo</th>
                      <th>Serviço</th>
                      <th>Chip</th>
                      <th>Número ativado</th>
                      <th>DDD</th>
                      <th>GB</th>
                      <th>Fidelidade</th>
                      <th className="num">Valor unit.</th>
                      <th>Regra</th>
                      <th className="num">Comissão R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.map((linha, idx) => (
                      <tr
                        key={`${linha.venda_id}-${linha.chip_index}-${idx}`}
                        className={`${linha.sem_regra ? 'row-warning ' : ''}is-clickable`}
                        tabIndex={0}
                        title="Abrir venda"
                        onClick={() => abrirVenda(linha.venda_id)}
                        onKeyDown={event => handleLinhaKeyDown(event, linha.venda_id)}
                      >
                        <td>#{linha.venda_id}</td>
                        <td>{fmtData(linha.data_ativacao)}</td>
                        <td>{fmtData(linha.data_venda)}</td>
                        <td>{linha.vendedora?.nome || '-'}</td>
                        <td>{linha.cliente?.nome || linha.cliente?.razao_social || '-'}</td>
                        <td>{linha.cliente?.cnpj || '-'}</td>
                        <td>{linha.operadora?.nome || '-'}</td>
                        <td>{linha.cliente?.operadora_atual?.nome || '-'}</td>
                        <td>{fmtRepasse(linha)}</td>
                        <td>{linha.tipo_venda || '-'}</td>
                        <td>{linha.servico || '-'}</td>
                        <td>{linha.chip_index}</td>
                        <td>{linha.numero_ativado || '-'}</td>
                        <td>{linha.ddd || '-'}</td>
                        <td>{linha.gb || '-'}</td>
                        <td>{fmtData(linha.cliente?.fidelidade_fim)}</td>
                        <td className="num">{fmtMoeda(linha.valor_unitario)}</td>
                        <td>{fmtRegra(linha.regra_comissao)}</td>
                        <td className="num">{linha.comissao != null ? fmtMoeda(linha.comissao) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              )}

              <div className="fechamento-totais">
                <div className="fechamento-totais__title">Comissão por vendedora</div>
                {totaisPorVendedora.length === 0 ? (
                  <div className="muted">Nenhuma comissão calculada.</div>
                ) : (
                  totaisPorVendedora.map(item => (
                    <div className="fechamento-totais__row" key={item.vendedora_id ?? item.vendedora_nome}>
                      <span>{item.vendedora_nome} <span className="muted">({item.total_ugrs} UGRs)</span></span>
                      <strong>{fmtMoeda(item.total_comissao)}</strong>
                    </div>
                  ))
                )}
                <div className="fechamento-totais__geral">
                  <span>Total geral</span>
                  <span>{fmtMoeda(totalGeral.comissao)}</span>
                </div>
                {totalGeral.ugrs_sem_regra > 0 && (
                  <div className="muted">
                    {totalGeral.ugrs_sem_regra} UGR(s) sem regra não entram nos totais.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default DetalhesAtivasModal;
