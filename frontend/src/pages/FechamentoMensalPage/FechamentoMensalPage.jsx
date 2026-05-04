import { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getResumo } from '../../services/fechamento.service';
import DetalhesAtivasModal from './DetalhesAtivasModal';
import DetalhesModal from './DetalhesModal';
import FechamentoSecao from './FechamentoSecao';
import './FechamentoMensalPage.css';

function dataISO(data) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0')
  ].join('-');
}

function periodoMesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  return {
    data_inicio: dataISO(inicio),
    data_fim: dataISO(fim)
  };
}

function dataValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
}

function FechamentoMensalPage() {
  const [periodo, setPeriodo] = useState(() => periodoMesAtual());
  const [periodoConsulta, setPeriodoConsulta] = useState(() => periodoMesAtual());
  const [taxaComissao, setTaxaComissao] = useState('');
  const [resumo, setResumo] = useState({ total: [], tratando: [], ativas: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modalDetalhes, setModalDetalhes] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');

    getResumo(periodoConsulta)
      .then(dados => {
        if (!ativo) return;
        setResumo(dados?.secoes || { total: [], tratando: [], ativas: [] });
      })
      .catch(error => {
        if (!ativo) return;
        setErro(error.message || 'Erro ao carregar fechamento mensal.');
      })
      .finally(() => {
        if (!ativo) return;
        setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [periodoConsulta]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function atualizarPeriodo(campo, valor) {
    setPeriodo(prev => ({ ...prev, [campo]: valor }));

    if (dataValida(valor)) {
      setPeriodoConsulta(prev => ({ ...prev, [campo]: valor }));
    }
  }

  return (
    <LayoutPrivado>
      <div className="fechamento-page">
        <div className="fechamento-filtros">
          <div className="form-field">
            <label>Data inicial</label>
            <input
              type="date"
              value={periodo.data_inicio}
              onChange={event => atualizarPeriodo('data_inicio', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Data final</label>
            <input
              type="date"
              value={periodo.data_fim}
              onChange={event => atualizarPeriodo('data_fim', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Taxa comissão UGR (%)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxaComissao}
              onChange={event => setTaxaComissao(event.target.value)}
              placeholder="15"
            />
          </div>
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <FechamentoSecao
          titulo="Total de vendas"
          subtitulo="Todos os status do funil, exceto retornos"
          linhas={resumo.total || []}
          secao="total"
          loading={loading}
          onDetalhes={setModalDetalhes}
        />

        <FechamentoSecao
          titulo="Contratos tratando"
          subtitulo="Aprovacao, ativacao, envio, entrega e confirmacao"
          linhas={resumo.tratando || []}
          secao="tratando"
          loading={loading}
          onDetalhes={setModalDetalhes}
        />

        <FechamentoSecao
          titulo="Vendas ativas"
          subtitulo="Contratos concluidos, com UGRs por chip"
          linhas={resumo.ativas || []}
          secao="ativas"
          loading={loading}
          onDetalhes={setModalDetalhes}
        />

        {modalDetalhes && modalDetalhes !== 'ativas' && (
          <DetalhesModal
            secao={modalDetalhes}
            periodo={periodoConsulta}
            onClose={() => setModalDetalhes(null)}
          />
        )}

        {modalDetalhes === 'ativas' && (
          <DetalhesAtivasModal
            periodo={{ ...periodoConsulta, taxa_comissao: taxaComissao }}
            onClose={() => setModalDetalhes(null)}
          />
        )}


      </div>
    </LayoutPrivado>
  );
}

export default FechamentoMensalPage;
