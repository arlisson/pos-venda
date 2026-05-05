import { useEffect, useState } from 'react';
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

function DetalhesAtivasModal({ periodo, onClose }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);

    getDetalhesChips({ ...periodo })
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
  }, [periodo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalGeral = dados.total_geral || DADOS_VAZIOS.total_geral;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fechamento-modal-large" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Detalhes - Vendas ativas (linha por UGR)</div>
              <div className="modal-sub">
                {dados.linhas.length} UGR(s) ativas - Comissão total: {fmtMoeda(totalGeral.comissao)}
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
            <div className="fechamento-empty">Nenhum chip ativo no período.</div>
          ) : (
            <>
              <div style={{ overflow: 'auto', maxHeight: '58vh' }}>
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
                      <th>Tipo</th>
                      <th>Serviço</th>
                      <th>Chip</th>
                      <th>DDD</th>
                      <th>GB</th>
                      <th>Fidelidade</th>
                      <th className="num">Valor unit.</th>
                      <th>Regra</th>
                      <th className="num">Comissão R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.linhas.map((linha, idx) => (
                      <tr key={`${linha.venda_id}-${linha.chip_index}-${idx}`} className={linha.sem_regra ? 'row-warning' : ''}>
                        <td>#{linha.venda_id}</td>
                        <td>{fmtData(linha.data_ativacao)}</td>
                        <td>{fmtData(linha.data_venda)}</td>
                        <td>{linha.vendedora?.nome || '-'}</td>
                        <td>{linha.cliente?.nome || linha.cliente?.razao_social || '-'}</td>
                        <td>{linha.cliente?.cnpj || '-'}</td>
                        <td>{linha.operadora?.nome || '-'}</td>
                        <td>{linha.tipo_venda || '-'}</td>
                        <td>{linha.servico || '-'}</td>
                        <td>{linha.chip_index}</td>
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

              <div className="fechamento-totais">
                <div className="fechamento-totais__title">Comissão por vendedora</div>
                {dados.totais_por_vendedora.length === 0 ? (
                  <div className="muted">Nenhuma comissão calculada.</div>
                ) : (
                  dados.totais_por_vendedora.map(item => (
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
