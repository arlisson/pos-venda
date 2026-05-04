import { useEffect, useState } from 'react';
import * as I from '../../components/Icons';
import { getDetalhesChips } from '../../services/fechamento.service';

function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(valor) {
  if (!valor) return '—';
  const iso = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function DetalhesAtivasModal({ periodo, onClose }) {
  const [dados, setDados] = useState({ linhas: [], totais_por_vendedora: [], total_geral: { chips: 0, comissao: 0 } });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);

    getDetalhesChips({ ...periodo })
      .then(resp => {
        if (!ativo) return;
        setDados(resp || { linhas: [], totais_por_vendedora: [], total_geral: { chips: 0, comissao: 0 } });
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fechamento-modal-large" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Detalhes — Vendas ativas (linha por chip)</div>
              <div className="modal-sub">
                {dados.linhas.length} chip(s) ativos · Comissão total: {fmtMoeda(dados.total_geral?.comissao)}
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
              <div style={{ overflow: 'auto', maxHeight: '50vh' }}>
                <table className="fechamento-modal-table">
                  <thead>
                    <tr>
                      <th>Venda</th>
                      <th>Data</th>
                      <th>Vendedora</th>
                      <th>Cliente</th>
                      <th>CNPJ</th>
                      <th>Operadora</th>
                      <th>GB</th>
                      <th>Tipo</th>
                      <th>Serviço</th>
                      <th>Chip</th>
                      <th>DDD</th>
                      <th>GB</th>
                      <th>Fidelidade</th>
                      <th className="num">Valor unit.</th>
                      <th className="num">Taxa</th>
                      <th className="num">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.linhas.map((linha, idx) => (
                      <tr key={`${linha.venda_id}-${linha.chip_index}-${idx}`}>
                        <td>#{linha.venda_id}</td>
                        <td>{fmtData(linha.data_venda)}</td>
                        <td>{linha.vendedora?.nome || '—'}</td>
                        <td>{linha.cliente?.nome || linha.cliente?.razao_social || '—'}</td>
                        <td>{linha.cliente?.cnpj || '—'}</td>
                        <td>{linha.operadora?.nome || '—'}</td>
                        <td>{linha.gb || '—'}</td>
                        <td>{linha.tipo_venda || '—'}</td>
                        <td>{linha.servico || '—'}</td>
                        <td>{linha.chip_index}</td>
                        <td>{linha.ddd || '—'}</td>
                        <td>{linha.gb || '—'}</td>
                        <td>{fmtData(linha.cliente?.fidelidade_fim)}</td>
                        <td className="num">{fmtMoeda(linha.valor_unitario)}</td>
                        <td className="num">{linha.taxa_comissao != null ? `${linha.taxa_comissao}%` : '—'}</td>
                        <td className="num">
                          {linha.comissao != null ? fmtMoeda(linha.comissao) : '—'}
                        </td>
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
                      <span>{item.vendedora_nome} <span className="muted">({item.total_chips} chips)</span></span>
                      <strong>{fmtMoeda(item.total_comissao)}</strong>
                    </div>
                  ))
                )}
                <div className="fechamento-totais__geral">
                  <span>Total geral</span>
                  <span>{fmtMoeda(dados.total_geral?.comissao)}</span>
                </div>
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
