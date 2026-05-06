import { useEffect, useMemo, useRef, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarVendedoras } from '../../services/venda.service';
import {
  atualizarLeadSchema,
  criarLeadPlanilha,
  dividirLeadLinhas,
  excluirLeadPlanilha,
  exportarLeadLinhas,
  finalizarLeadPlanilha,
  listarLeadLinhas,
  listarLeadPlanilhas,
  marcarErroLeadPlanilha,
  salvarLeadLinhas
} from '../../services/lead-planilha.service';
import './AdminLeadsPage.css';

const PAGE_SIZE = 200;
const OPS = {
  string: [
    ['contains', 'Contem'],
    ['exact', 'Exato'],
    ['starts', 'Comeca com'],
    ['ends', 'Termina com']
  ],
  number: [
    ['contains', 'Contem'],
    ['exact', 'Exato'],
    ['starts', 'Comeca com'],
    ['ends', 'Termina com']
  ],
  date: [
    ['exact', 'Data exata'],
    ['between', 'De/ate']
  ]
};

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getValorColuna(linha, coluna) {
  if (!coluna) return '';
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return linha.dados_json?.[source?.nome || coluna.nome] ?? '';
}

function getStatusDistribuicao(linha) {
  return linha.atribuido_para_id || linha.atribuidoPara || linha.envio_id || linha.envio
    ? 'Enviado'
    : 'Não enviado';
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function getConflitosColunas(planilhasSelecionadas) {
  const mapa = new Map();

  planilhasSelecionadas.forEach(planilha => {
    (planilha.colunas || []).forEach(coluna => {
      const chave = normalizarTexto(coluna);
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          label: coluna,
          ocorrencias: []
        });
      }
      mapa.get(chave).ocorrencias.push({
        planilhaId: planilha.id,
        planilhaNome: planilha.nome,
        coluna
      });
    });
  });

  return Array.from(mapa.values())
    .filter(grupo => new Set(grupo.ocorrencias.map(item => item.planilhaId)).size > 1);
}

function montarFiltrosBackend(filtros, colunas, planilhasSelecionadas, schema) {
  return filtros.map(filtro => {
    const coluna = colunas.find(item => item.id === filtro.coluna);
    const planilha = coluna?.planilhaId
      ? planilhasSelecionadas.find(item => item.id === coluna.planilhaId)
      : null;

    return {
      coluna: coluna?.nome || filtro.coluna,
      planilha_id: coluna?.planilhaId || null,
      tipo: planilha?.schema_colunas?.[coluna?.nome] || schema[coluna?.nome] || 'string',
      op: filtro.op,
      valor: filtro.valor,
      valor2: filtro.valor2
    };
  });
}

function DividirModal({ totalLinhas, resumoLeads, colunas, vendedoras, filtrosDivisao, onClose, onSave }) {
  const [nome, setNome] = useState(`Envio ${new Date().toLocaleDateString('pt-BR')}`);
  const [usuarios, setUsuarios] = useState([]);
  const [quantidade, setQuantidade] = useState(String(totalLinhas));
  const [colunasVisiveis, setColunasVisiveis] = useState(colunas);
  const [manual, setManual] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [incluirEnviados, setIncluirEnviados] = useState(false);

  function toggleUsuario(id) {
    setUsuarios(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }

  function moverColuna(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= colunasVisiveis.length) return;
    const proximas = [...colunasVisiveis];
    const [item] = proximas.splice(index, 1);
    proximas.splice(novoIndex, 0, item);
    setColunasVisiveis(proximas);
  }

  async function submit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const resultado = await onSave({
        nome,
        quantidade_total: Number(quantidade),
        usuario_ids: usuarios,
        filtros: filtrosDivisao,
        colunas_visiveis: colunasVisiveis,
        incluir_enviados: incluirEnviados,
        alocacao_manual: manual?.valores || {}
      });

      if (resultado?.requires_manual_allocation) {
        setManual({
          sobra: resultado.sobra,
          base: resultado.base,
          valores: usuarios.reduce((acc, id) => ({ ...acc, [id]: 0 }), {})
        });
        setSalvando(false);
        return;
      }

      onClose();
    } catch (error) {
      setErro(error.message || 'Erro ao dividir clientes.');
      setSalvando(false);
    }
  }

  const sobraManual = manual
    ? Object.values(manual.valores).reduce((acc, valor) => acc + Number(valor || 0), 0)
    : 0;
  const quantidadeNumerica = Number(quantidade || 0);
  const disponiveisPadrao = Number(resumoLeads?.nao_enviados || 0);
  const jaEnviados = Number(resumoLeads?.enviados || 0);
  const totalResumo = Number(resumoLeads?.total || totalLinhas || 0);
  const capacidadeAtual = incluirEnviados ? totalResumo : disponiveisPadrao;
  const vaiTransferir = incluirEnviados
    ? Math.max(0, quantidadeNumerica - disponiveisPadrao)
    : 0;

  return (
    <div className="modal-overlay">
      <form className="modal leads-divide-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Dividir clientes</div>
              <div className="modal-sub">Escolha vendedores, quantidade e colunas enviadas.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="leads-divide-grid">
            <div className="form-field">
              <label>Nome do envio</label>
              <input value={nome} onChange={event => setNome(event.target.value)} required />
            </div>
            <div className="form-field">
              <label>Quantidade</label>
              <input type="number" min="1" max={totalLinhas} value={quantidade} onChange={event => setQuantidade(event.target.value)} required />
            </div>
          </div>

          <div className="leads-divide-summary">
            <div>
              <span>Disponiveis agora</span>
              <strong>{formatarNumero(disponiveisPadrao)}</strong>
            </div>
            <div>
              <span>Ja enviados</span>
              <strong>{formatarNumero(jaEnviados)}</strong>
            </div>
            <div>
              <span>Capacidade selecionada</span>
              <strong>{formatarNumero(capacidadeAtual)}</strong>
            </div>
            <div className={quantidadeNumerica > capacidadeAtual ? 'danger' : ''}>
              <span>Quantidade deste envio</span>
              <strong>{formatarNumero(quantidadeNumerica)}</strong>
            </div>
          </div>

          <div className="leads-divide-help">
            {incluirEnviados
              ? `Este envio pode usar leads novos e transferir ate ${formatarNumero(Math.min(vaiTransferir, jaEnviados))} lead(s) ja enviados.`
              : 'O envio automático começa no próximo lead ainda não enviado e ignora os leads já distribuídos.'}
          </div>

          <label className="leads-transfer-toggle">
            <input
              type="checkbox"
              checked={incluirEnviados}
              onChange={event => setIncluirEnviados(event.target.checked)}
            />
            <span>
              <strong>Incluir leads ja enviados</strong>
              <small>Use para transferir leads que ja foram enviados para outro vendedor.</small>
            </span>
          </label>

          {incluirEnviados && (
            <div className="leads-warning">
              Leads ja enviados que entrarem nesta divisao serao transferidos para o novo vendedor e novo envio.
            </div>
          )}

          <div className="leads-block-title">Vendedores</div>
          <div className="leads-seller-grid">
            {vendedoras.map(vendedora => (
              <label key={vendedora.id} className="leads-check-card">
                <input type="checkbox" checked={usuarios.includes(vendedora.id)} onChange={() => toggleUsuario(vendedora.id)} />
                <span>{vendedora.nome}</span>
              </label>
            ))}
          </div>

          {manual && (
            <div className="leads-warning">
              A divisao deixou {manual.sobra} cliente(s) sobrando. Distribua manualmente a sobra abaixo. Base: {manual.base} por vendedor.
              <div className="leads-manual-grid">
                {usuarios.map(id => {
                  const vendedor = vendedoras.find(item => item.id === id);
                  return (
                    <label key={id}>
                      <span>{vendedor?.nome || id}</span>
                      <input
                        type="number"
                        min="0"
                        value={manual.valores[id] ?? 0}
                        onChange={event => setManual(prev => ({
                          ...prev,
                          valores: { ...prev.valores, [id]: event.target.value }
                        }))}
                      />
                    </label>
                  );
                })}
              </div>
              <span>{sobraManual}/{manual.sobra} alocados</span>
            </div>
          )}

          <div className="leads-block-title">Colunas enviadas</div>
          <div className="leads-column-editor">
            {colunasVisiveis.map((coluna, index) => (
              <div key={coluna.id || coluna} className="leads-column-row">
                <span>{coluna.label || coluna}</span>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, -1)} title="Subir">Up</button>
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, 1)} title="Descer">Dn</button>
                <button type="button" className="btn btn-icon btn-ghost btn-danger-icon" onClick={() => setColunasVisiveis(prev => prev.filter(item => (item.id || item) !== (coluna.id || coluna)))} title="Remover">
                  <I.Trash size={13} />
                </button>
              </div>
            ))}
          </div>

          {erro && <div className="alert-error">{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando || usuarios.length === 0 || colunasVisiveis.length === 0}>
            {salvando ? 'Enviando...' : 'Enviar leads'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MesclarColunasModal({ grupos, defaultSelecionadas, onClose, onConfirm }) {
  const [selecionadas, setSelecionadas] = useState(defaultSelecionadas);

  function toggle(chave) {
    setSelecionadas(prev => (
      prev.includes(chave)
        ? prev.filter(item => item !== chave)
        : [...prev, chave]
    ));
  }

  function selecionarTodas() {
    setSelecionadas(grupos.map(grupo => grupo.chave));
  }

  function limparTodas() {
    setSelecionadas([]);
  }

  return (
    <div className="modal-overlay">
      <div className="modal leads-merge-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Mesclar colunas iguais?</div>
              <div className="modal-sub">Escolha quais colunas com o mesmo nome devem aparecer como uma coluna unica no layout.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="leads-merge-actions">
            <button type="button" className="btn btn-sm" onClick={selecionarTodas}>Mesclar todas</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={limparTodas}>Separar todas</button>
          </div>

          <div className="leads-merge-list">
            {grupos.map(grupo => (
              <label key={grupo.chave} className="leads-merge-card">
                <input
                  type="checkbox"
                  checked={selecionadas.includes(grupo.chave)}
                  onChange={() => toggle(grupo.chave)}
                />
                <div>
                  <strong>{grupo.label}</strong>
                  <span>
                    {grupo.ocorrencias.map(item => `${item.coluna} em ${item.planilhaNome}`).join(' | ')}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(selecionadas)}>
            Aplicar selecao
          </button>
        </div>
      </div>
    </div>
  );
}

function ExcluirPlanilhaModal({ planilha, carregando, erro, onClose, onConfirm }) {
  if (!planilha) return null;

  return (
    <div className="modal-overlay">
      <div className="modal leads-delete-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Excluir planilha?</div>
              <div className="modal-sub">Essa ação remove a planilha, suas linhas importadas e os leads enviados aos usuários.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={carregando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="leads-delete-summary">
            <div className="lead-doc-preview">
              <span></span><span></span><span></span><span></span>
            </div>
            <div>
              <strong>{planilha.nome}</strong>
              <span>{planilha.total_linhas || 0} linha(s)</span>
              <small>Se houver leads distribuidos, eles deixarao de aparecer para os vendedores.</small>
              {planilha.status === 'processando' && (
                <small>A planilha ainda esta processando e o backend vai bloquear a exclusao.</small>
              )}
            </div>
            <button type="button" className="leads-delete-trash-icon" disabled={carregando} onClick={onConfirm} title="Excluir planilha">
              <I.Trash size={18} />
            </button>
          </div>

          {erro && <div className="alert-error">{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={carregando}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={carregando}>
            <I.Trash size={13} /> {carregando ? 'Excluindo...' : 'Excluir planilha'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLeadsPage() {
  const inputRef = useRef(null);
  const [planilhas, setPlanilhas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [resumoLeads, setResumoLeads] = useState({ total: 0, enviados: 0, nao_enviados: 0 });
  const [vendedoras, setVendedoras] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState([]);
  const [novoFiltro, setNovoFiltro] = useState({ coluna: '', op: 'contains', valor: '', valor2: '' });
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [schemaAberto, setSchemaAberto] = useState(false);
  const [modalDividir, setModalDividir] = useState(false);
  const [colunasMescladas, setColunasMescladas] = useState([]);
  const [modalMesclar, setModalMesclar] = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');

  async function carregarBase() {
    setCarregando(true);
    setErro('');
    try {
      const [planilhasData, vendedorasData] = await Promise.all([
        listarLeadPlanilhas(),
        listarVendedoras()
      ]);
      setPlanilhas(planilhasData);
      setVendedoras(vendedorasData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar planilhas.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregarBase();
  }, []);

  /* eslint-enable react-hooks/set-state-in-effect */

  const planilhasSelecionadas = useMemo(() => (
    planilhas.filter(planilha => selecionadas.includes(planilha.id))
  ), [planilhas, selecionadas]);

  const colunas = useMemo(() => {
    const grupos = new Map();

    planilhasSelecionadas.forEach(planilha => {
      (planilha.colunas || []).forEach(coluna => {
        const chave = normalizarTexto(coluna);
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            chave,
            label: coluna,
            sources: []
          });
        }
        grupos.get(chave).sources.push({
          planilhaId: planilha.id,
          planilhaNome: planilha.nome,
          nome: coluna
        });
      });
    });

    return Array.from(grupos.values()).flatMap(grupo => {
      const planilhasDoGrupo = new Set(grupo.sources.map(source => source.planilhaId));
      const deveMesclar = planilhasDoGrupo.size > 1 && colunasMescladas.includes(grupo.chave);

      if (deveMesclar || planilhasDoGrupo.size === 1) {
        return [{
          id: deveMesclar ? `merge::${grupo.chave}` : `${grupo.sources[0].planilhaId}::${grupo.sources[0].nome}`,
          nome: grupo.sources[0].nome,
          label: grupo.label,
          planilhaId: deveMesclar ? null : grupo.sources[0].planilhaId,
          sources: grupo.sources
        }];
      }

      return grupo.sources.map(source => ({
        id: `${source.planilhaId}::${source.nome}`,
        nome: source.nome,
        label: `${source.nome} - ${source.planilhaNome}`,
        planilhaId: source.planilhaId,
        sources: [source]
      }));
    });
  }, [planilhasSelecionadas, colunasMescladas]);

  const schema = useMemo(() => {
    const resultado = {};
    planilhasSelecionadas.forEach(planilha => {
      Object.assign(resultado, planilha.schema_colunas || {});
    });
    return resultado;
  }, [planilhasSelecionadas]);

  const filtrosBackend = useMemo(() => (
    montarFiltrosBackend(filtros, colunas, planilhasSelecionadas, schema)
  ), [filtros, colunas, planilhasSelecionadas, schema]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selecionadas.length === 0) {
      setLinhas([]);
      setTotalLinhas(0);
      setResumoLeads({ total: 0, enviados: 0, nao_enviados: 0 });
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarLeadLinhas({
      planilha_ids: selecionadas,
      page: pagina,
      page_size: PAGE_SIZE,
      busca,
      filters: JSON.stringify(filtrosBackend)
    })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotalLinhas(data.total || 0);
          setResumoLeads(data.resumo || {
            total: data.total || 0,
            enviados: 0,
            nao_enviados: data.total || 0
          });
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar linhas.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [selecionadas, pagina, busca, filtrosBackend]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const linhasFiltradas = useMemo(() => {
    return linhas;
  }, [linhas]);

  const linhasPagina = useMemo(() => {
    return linhasFiltradas;
  }, [linhasFiltradas]);

  const totalPaginas = Math.max(1, Math.ceil(totalLinhas / PAGE_SIZE));
  const percentualEnviado = resumoLeads.total > 0
    ? Math.round((Number(resumoLeads.enviados || 0) / Number(resumoLeads.total || 1)) * 100)
    : 0;

  async function importarArquivo(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) return;

    setProcessando(`Preparando ${file.name}`);
    setErro('');

    const planilha = await criarLeadPlanilha({
      nome: file.name,
      colunas: [],
      schema_colunas: {},
      total_linhas: 0,
      streaming: true
    });

    await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./csv.worker.js', import.meta.url), { type: 'module' });
      const queue = [];
      const maxParallel = 2;
      const maxRetries = 3;
      let active = 0;
      let finishedParsing = false;
      let donePayload = null;
      let rejected = false;
      let parsedProgress = 0;
      let parsedRows = 0;
      let sentBatches = 0;
      let totalBatches = 0;

      function updateImportStatus() {
        setProcessando(`Parseando ${parsedProgress}% | Enviando lote ${sentBatches}/${Math.max(totalBatches, sentBatches)}`);
      }

      function finishWithError(error) {
        if (rejected) return;
        rejected = true;
        worker.terminate();
        marcarErroLeadPlanilha(planilha.id, error.message || 'Erro ao importar CSV.').catch(() => {});
        reject(error);
      }

      async function sendBatch(item) {
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
          try {
            await salvarLeadLinhas(planilha.id, item.rows);
            return;
          } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resume => setTimeout(resume, 400 * attempt));
          }
        }
      }

      async function tryFinish() {
        if (!finishedParsing || active > 0 || queue.length > 0 || rejected) return;

        try {
          setProcessando(`Finalizando ${file.name}: ${donePayload?.total_linhas || parsedRows} linhas`);
          await finalizarLeadPlanilha(planilha.id, {
            colunas: donePayload?.colunas || [],
            schema_colunas: donePayload?.schema_colunas || {}
          });
          worker.terminate();
          resolve();
        } catch (error) {
          finishWithError(error);
        }
      }

      function pumpQueue() {
        while (active < maxParallel && queue.length > 0 && !rejected) {
          const item = queue.shift();
          active += 1;
          sendBatch(item)
            .then(() => {
              sentBatches += 1;
              updateImportStatus();
            })
            .catch(finishWithError)
            .finally(() => {
              active -= 1;
              pumpQueue();
              tryFinish();
            });
        }
      }

      worker.onmessage = (event) => {
        const message = event.data || {};

        if (message.type === 'progress') {
          parsedProgress = message.progress || 0;
          parsedRows = message.parsedRows || parsedRows;
          updateImportStatus();
          return;
        }

        if (message.type === 'batch') {
          parsedProgress = message.progress || parsedProgress;
          parsedRows = message.parsedRows || parsedRows;
          totalBatches += 1;
          queue.push({ batchId: message.batchId, rows: message.rows || [] });
          updateImportStatus();
          pumpQueue();
          return;
        }

        if (message.type === 'done') {
          finishedParsing = true;
          parsedProgress = 100;
          donePayload = message;
          updateImportStatus();
          tryFinish();
          return;
        }

        if (message.type === 'error') {
          finishWithError(new Error(message.message || 'Erro ao processar CSV.'));
        }
      };

      worker.onerror = () => {
        finishWithError(new Error('Erro no worker de processamento CSV.'));
      };

      worker.postMessage({ file });
    });
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    try {
      for (const file of files) {
        await importarArquivo(file);
      }
      setProcessando('');
      await carregarBase();
      setSucesso('Planilha importada com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao importar planilha.');
    } finally {
      setProcessando('');
    }
  }

  function togglePlanilha(id) {
    const jaSelecionada = selecionadas.includes(id);
    const proximas = jaSelecionada ? selecionadas.filter(item => item !== id) : [...selecionadas, id];
    const proximasPlanilhas = planilhas.filter(planilha => proximas.includes(planilha.id));
    const conflitos = getConflitosColunas(proximasPlanilhas);

    if (proximas.length > 1 && conflitos.length > 0 && !jaSelecionada) {
      setModalMesclar({
        selecionadas: proximas,
        grupos: conflitos
      });
      return;
    }

    setFiltros([]);
    setNovoFiltro({ coluna: '', op: 'contains', valor: '', valor2: '' });
    setColunasMescladas(prev => prev.filter(chave => conflitos.some(grupo => grupo.chave === chave)));
    setSelecionadas(proximas);
  }

  function aplicarMesclagemColunas(chaves) {
    const conflitos = modalMesclar?.grupos || [];
    const chavesConflito = new Set(conflitos.map(grupo => grupo.chave));

    setColunasMescladas(prev => [
      ...prev.filter(chave => !chavesConflito.has(chave)),
      ...chaves
    ]);
    setFiltros([]);
    setNovoFiltro({ coluna: '', op: 'contains', valor: '', valor2: '' });
    setSelecionadas(modalMesclar?.selecionadas || selecionadas);
    setModalMesclar(null);
  }

  function adicionarFiltro() {
    if (!novoFiltro.coluna) return;
    setFiltros(prev => [...prev, { ...novoFiltro, id: crypto.randomUUID() }]);
    setNovoFiltro({ coluna: novoFiltro.coluna, op: 'contains', valor: '', valor2: '' });
    setPagina(1);
  }

  async function exportarCsvBackend() {
    const blob = await exportarLeadLinhas({
      planilha_ids: selecionadas,
      busca,
      filters: filtrosBackend,
      colunas
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function alterarTipo(planilha, coluna, tipo) {
    const schemaAtualizado = {
      ...(planilha.schema_colunas || {}),
      [coluna]: tipo
    };
    const atualizada = await atualizarLeadSchema(planilha.id, schemaAtualizado);
    setPlanilhas(prev => prev.map(item => item.id === planilha.id ? atualizada : item));
  }

  async function salvarDivisao(payload) {
    const resultado = await dividirLeadLinhas({
      ...payload,
      filtros: {
        ...(payload.filtros || {}),
        filters: filtrosBackend
      }
    });
    if (!resultado?.requires_manual_allocation) {
      setSucesso(resultado?.total_reenviados > 0
        ? `Leads enviados. ${resultado.total_reenviados} lead(s) ja enviados foram transferidos.`
        : 'Leads enviados para os vendedores.');
      setSelecionadas([...selecionadas]);
    }
    return resultado;
  }

  async function confirmarExclusaoPlanilha() {
    if (!modalExcluir) return;

    setErro('');
    setSucesso('');
    setErroExclusao('');
    setExcluindoId(modalExcluir.id);

    try {
      await excluirLeadPlanilha(modalExcluir.id);
      setSelecionadas(prev => prev.filter(id => id !== modalExcluir.id));
      setFiltros([]);
      setNovoFiltro({ coluna: '', op: 'contains', valor: '', valor2: '' });
      setColunasMescladas([]);
      setPagina(1);
      setModalExcluir(null);
      await carregarBase();
      setSucesso('Planilha excluida com sucesso.');
    } catch (error) {
      const mensagem = error.message || 'Erro ao excluir planilha.';
      setErroExclusao(mensagem);
      setErro(mensagem);
    } finally {
      setExcluindoId(null);
    }
  }

  function getTipoColunaPorId(colunaId) {
    const coluna = colunas.find(item => item.id === colunaId);
    if (!coluna) return 'string';

    if (coluna.planilhaId) {
      return planilhasSelecionadas.find(planilha => planilha.id === coluna.planilhaId)?.schema_colunas?.[coluna.nome] || 'string';
    }

    return schema[coluna.nome] || 'string';
  }

  const tipoFiltro = getTipoColunaPorId(novoFiltro.coluna);
  const opsFiltro = OPS[tipoFiltro] || OPS.string;
  const colunasDivisao = colunas.map(coluna => ({
    id: coluna.id,
    nome: coluna.nome,
    label: coluna.label,
    planilhaId: coluna.planilhaId,
    sources: coluna.sources
  }));

  return (
    <LayoutPrivado>
      {modalMesclar && (
        <MesclarColunasModal
          grupos={modalMesclar.grupos}
          defaultSelecionadas={modalMesclar.grupos.map(grupo => grupo.chave)}
          onClose={() => setModalMesclar(null)}
          onConfirm={aplicarMesclagemColunas}
        />
      )}

      {modalExcluir && (
        <ExcluirPlanilhaModal
          planilha={modalExcluir}
          carregando={excluindoId === modalExcluir.id}
          erro={erroExclusao}
          onClose={() => {
            if (excluindoId) return;
            setModalExcluir(null);
            setErroExclusao('');
          }}
          onConfirm={confirmarExclusaoPlanilha}
        />
      )}

      {modalDividir && (
        <DividirModal
          totalLinhas={totalLinhas}
          resumoLeads={resumoLeads}
          colunas={colunasDivisao}
          vendedoras={vendedoras}
          filtrosDivisao={{
            planilha_ids: selecionadas,
            busca,
            filters: filtrosBackend
          }}
          onClose={() => setModalDividir(false)}
          onSave={salvarDivisao}
        />
      )}

      <div className="admin-leads-page">
        <input ref={inputRef} type="file" accept=".csv" multiple hidden onChange={handleUpload} />

        <div className="lead-doc-strip">
          <div className="lead-doc-strip__title">
            <span>Planilhas</span>
            <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
              <I.Plus size={14} /> Upload CSV
            </button>
          </div>

          <div className="lead-doc-list">
            {planilhas.map(planilha => (
              <div
                key={planilha.id}
                role="button"
                tabIndex={0}
                className={`lead-doc-card ${selecionadas.includes(planilha.id) ? 'active' : ''}`}
                onClick={() => togglePlanilha(planilha.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    togglePlanilha(planilha.id);
                  }
                }}
              >
                <button
                  type="button"
                  className="lead-doc-delete"
                  title="Excluir planilha"
                  aria-label={`Excluir ${planilha.nome}`}
                  onClick={event => {
                    event.stopPropagation();
                    setErroExclusao('');
                    setModalExcluir(planilha);
                  }}
                />
                <div className="lead-doc-preview">
                  <span></span><span></span><span></span><span></span>
                </div>
                <strong title={planilha.nome}>{planilha.nome}</strong>
                <small>
                  {planilha.status === 'processando'
                    ? 'Processando...'
                    : `${planilha.total_linhas} linhas`}
                </small>
              </div>
            ))}

            {!carregando && planilhas.length === 0 && (
              <div className="lead-doc-empty">Nenhuma planilha importada.</div>
            )}
          </div>
        </div>

        <div className="admin-leads-toolbar">
          <div className="search-box">
            <I.Search size={14} />
            <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar em todas as colunas" />
          </div>

          <select
            value={novoFiltro.coluna}
            onChange={event => setNovoFiltro(prev => ({ ...prev, coluna: event.target.value, op: OPS[getTipoColunaPorId(event.target.value)][0][0] }))}
          >
            <option value="">Coluna</option>
            {colunas.map(coluna => <option key={coluna.id} value={coluna.id}>{coluna.label}</option>)}
          </select>
          <select value={novoFiltro.op} onChange={event => setNovoFiltro(prev => ({ ...prev, op: event.target.value }))}>
            {opsFiltro.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            type={tipoFiltro === 'date' ? 'date' : 'text'}
            value={novoFiltro.valor}
            onChange={event => setNovoFiltro(prev => ({ ...prev, valor: event.target.value }))}
            placeholder="Valor"
          />
          {novoFiltro.op === 'between' && (
            <input type="date" value={novoFiltro.valor2} onChange={event => setNovoFiltro(prev => ({ ...prev, valor2: event.target.value }))} />
          )}
          <button className="btn" type="button" onClick={adicionarFiltro}>
            <I.Filter size={14} /> Adicionar filtro
          </button>
          <button className="btn" type="button" onClick={() => setSchemaAberto(prev => !prev)}>
            Tipos
          </button>
          <button className="btn" type="button" onClick={exportarCsvBackend} disabled={totalLinhas === 0}>
            Exportar CSV
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setModalDividir(true)} disabled={totalLinhas === 0}>
            Dividir clientes
          </button>
        </div>

        {filtros.length > 0 && (
          <div className="lead-filter-chips">
            {filtros.map(filtro => (
              <button key={filtro.id} className="filter-chip active" type="button" onClick={() => setFiltros(prev => prev.filter(item => item.id !== filtro.id))}>
                {colunas.find(coluna => coluna.id === filtro.coluna)?.label || filtro.coluna}: {filtro.valor}{filtro.valor2 ? ` ate ${filtro.valor2}` : ''} x
              </button>
            ))}
          </div>
        )}

        {schemaAberto && (
          <div className="lead-schema-panel">
            {planilhasSelecionadas.map(planilha => (
              <div key={planilha.id}>
                <strong>{planilha.nome}</strong>
                <div className="lead-schema-grid">
                  {(planilha.colunas || []).map(coluna => (
                    <label key={coluna}>
                      <span>{coluna}</span>
                      <select value={planilha.schema_colunas?.[coluna] || 'string'} onChange={event => alterarTipo(planilha, coluna, event.target.value)}>
                        <option value="string">Texto</option>
                        <option value="number">Numero</option>
                        <option value="date">Data</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {(sucesso || erro || processando) && (
          <div className="lead-message-stack">
            {sucesso && <div className="alert-success alert-timed alert-timed--success">{sucesso}</div>}
            {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}
            {processando && <div className="lead-processing">{processando}</div>}
          </div>
        )}

        <div className="lead-results-meta">
          {totalLinhas} lead(s) encontrados
        </div>

        {resumoLeads.total > 0 && (
          <div className="lead-summary-panel">
            <div className="lead-summary-card">
              <span>Total filtrado</span>
              <strong>{formatarNumero(resumoLeads.total)}</strong>
            </div>
            <div className="lead-summary-card sent">
              <span>Leads enviados</span>
              <strong>{formatarNumero(resumoLeads.enviados)}</strong>
            </div>
            <div className="lead-summary-card pending">
              <span>A enviar</span>
              <strong>{formatarNumero(resumoLeads.nao_enviados)}</strong>
            </div>
            <div className="lead-summary-progress">
              <div className="lead-summary-progress__top">
                <span>Progresso de envio</span>
                <strong>{percentualEnviado}%</strong>
              </div>
              <div className="lead-summary-progress__bar">
                <span style={{ width: `${percentualEnviado}%` }}></span>
              </div>
            </div>
          </div>
        )}

        <div className="list-table lead-table">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Planilha</th>
                  <th>Status</th>
                  <th>Enviado para</th>
                  <th>Envio</th>
                  {colunas.map(coluna => <th key={coluna.id}>{coluna.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr><td colSpan={colunas.length + 4} className="muted">Carregando...</td></tr>
                ) : linhasPagina.length === 0 ? (
                  <tr><td colSpan={colunas.length + 4} className="muted">Selecione uma planilha para visualizar os leads.</td></tr>
                ) : (
                  linhasPagina.map(linha => (
                    <tr key={linha.id}>
                      <td><span className="tag">{linha.planilha?.nome || '-'}</span></td>
                      <td>
                        <span className={`lead-send-status ${getStatusDistribuicao(linha) === 'Enviado' ? 'sent' : 'pending'}`}>
                          {getStatusDistribuicao(linha)}
                        </span>
                      </td>
                      <td>{linha.atribuidoPara?.nome || '-'}</td>
                      <td>{linha.envio?.nome || '-'}</td>
                      {colunas.map(coluna => <td key={coluna.id}>{getValorColuna(linha, coluna) || '-'}</td>)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lead-pagination">
          <button className="btn" type="button" disabled={pagina <= 1} onClick={() => setPagina(prev => Math.max(1, prev - 1))}>Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button className="btn" type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(prev => Math.min(totalPaginas, prev + 1))}>Próxima</button>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default AdminLeadsPage;
