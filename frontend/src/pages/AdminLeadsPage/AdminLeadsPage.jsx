import { useEffect, useMemo, useRef, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarVendedoras } from '../../services/venda.service';
import {
  atualizarLeadSchema,
  criarLeadPlanilha,
  dividirLeadLinhas,
  listarLeadLinhas,
  listarLeadPlanilhas,
  salvarLeadLinhas
} from '../../services/lead-planilha.service';
import './AdminLeadsPage.css';

const PAGE_SIZE = 200;
const BATCH_SIZE = 1000;
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

function parseNumero(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;

  const limpo = texto.replace(/\s/g, '').replace(/^R\$/i, '');
  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');
  let normalizado = limpo;

  if (temVirgula && temPonto) {
    normalizado = limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function parseData(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!br) return '';

  const [, dia, mes, ano] = br;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  return `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function aplicarOperacao(valorOriginal, filtro, tipo) {
  if (!filtro.valor && filtro.op !== 'between') return true;

  if (tipo === 'date') {
    const data = parseData(valorOriginal);
    if (!data) return false;
    if (filtro.op === 'between') {
      return (!filtro.valor || data >= filtro.valor) && (!filtro.valor2 || data <= filtro.valor2);
    }
    return data === filtro.valor;
  }

  if (tipo === 'number') {
    const numero = parseNumero(valorOriginal);
    const valor = parseNumero(filtro.valor);
    if (numero === null || valor === null) return false;
    const textoNumero = String(numero);
    const textoFiltro = String(valor);
    if (filtro.op === 'exact') return numero === valor;
    if (filtro.op === 'starts') return textoNumero.startsWith(textoFiltro);
    if (filtro.op === 'ends') return textoNumero.endsWith(textoFiltro);
    return textoNumero.includes(textoFiltro);
  }

  const texto = normalizarTexto(valorOriginal);
  const busca = normalizarTexto(filtro.valor);
  if (filtro.op === 'exact') return texto === busca;
  if (filtro.op === 'starts') return texto.startsWith(busca);
  if (filtro.op === 'ends') return texto.endsWith(busca);
  return texto.includes(busca);
}

function csvEscape(valor) {
  const texto = String(valor ?? '');
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function baixarCsv(nome, colunas, linhas) {
  const conteudo = [
    colunas.map(coluna => csvEscape(coluna.label)).join(';'),
    ...linhas.map(linha => colunas.map(coluna => csvEscape(getValorColuna(linha, coluna))).join(';'))
  ].join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

function getValorColuna(linha, coluna) {
  if (!coluna) return '';
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return linha.dados_json?.[source?.nome || coluna.nome] ?? '';
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

function DividirModal({ linhas, colunas, vendedoras, onClose, onSave }) {
  const [nome, setNome] = useState(`Envio ${new Date().toLocaleDateString('pt-BR')}`);
  const [usuarios, setUsuarios] = useState([]);
  const [quantidade, setQuantidade] = useState(String(linhas.length));
  const [colunasVisiveis, setColunasVisiveis] = useState(colunas);
  const [manual, setManual] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

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
        linha_ids: linhas.map(linha => linha.id),
        colunas_visiveis: colunasVisiveis,
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
              <input type="number" min="1" max={linhas.length} value={quantidade} onChange={event => setQuantidade(event.target.value)} required />
            </div>
          </div>

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

function AdminLeadsPage() {
  const inputRef = useRef(null);
  const [planilhas, setPlanilhas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [linhas, setLinhas] = useState([]);
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

  useEffect(() => {
    if (selecionadas.length === 0) {
      setLinhas([]);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarLeadLinhas({ planilha_ids: selecionadas })
      .then(data => {
        if (!cancelado) {
          setLinhas(data);
          setPagina(1);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar linhas.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [selecionadas]);
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

  const linhasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca);
    return linhas.filter(linha => {
      const dados = linha.dados_json || {};
      const passaBusca = !termo || Object.values(dados).some(valor => normalizarTexto(valor).includes(termo));
      if (!passaBusca) return false;

      return filtros.every(filtro => {
        const coluna = colunas.find(item => item.id === filtro.coluna);
        const tipo = coluna?.planilhaId
          ? (planilhasSelecionadas.find(planilha => planilha.id === coluna.planilhaId)?.schema_colunas?.[coluna.nome] || 'string')
          : (schema[coluna?.nome] || 'string');
        return aplicarOperacao(getValorColuna(linha, coluna), filtro, tipo);
      });
    });
  }, [linhas, busca, filtros, schema, colunas, planilhasSelecionadas]);

  const linhasPagina = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE;
    return linhasFiltradas.slice(inicio, inicio + PAGE_SIZE);
  }, [linhasFiltradas, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / PAGE_SIZE));

  async function importarArquivo(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) return;

    setProcessando(`Processando ${file.name}`);
    setErro('');

    const worker = new Worker(new URL('./csv.worker.js', import.meta.url), { type: 'module' });

    await new Promise((resolve, reject) => {
      worker.onmessage = async (event) => {
        if (event.data.type === 'error') {
          reject(new Error(event.data.message));
          return;
        }

        if (event.data.type !== 'done') return;

        try {
          const payload = event.data.payload;
          const planilha = await criarLeadPlanilha({
            nome: payload.nome,
            colunas: payload.colunas,
            schema_colunas: payload.schema_colunas,
            total_linhas: payload.rows.length
          });

          for (let i = 0; i < payload.rows.length; i += BATCH_SIZE) {
            setProcessando(`Salvando ${payload.nome}: ${Math.min(i + BATCH_SIZE, payload.rows.length)}/${payload.rows.length}`);
            await salvarLeadLinhas(planilha.id, payload.rows.slice(i, i + BATCH_SIZE));
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      worker.onerror = () => reject(new Error('Erro ao processar CSV.'));
      worker.postMessage({ file });
    }).finally(() => worker.terminate());
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    try {
      for (const file of files) {
        await importarArquivo(file);
      }
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

  async function alterarTipo(planilha, coluna, tipo) {
    const schemaAtualizado = {
      ...(planilha.schema_colunas || {}),
      [coluna]: tipo
    };
    const atualizada = await atualizarLeadSchema(planilha.id, schemaAtualizado);
    setPlanilhas(prev => prev.map(item => item.id === planilha.id ? atualizada : item));
  }

  async function salvarDivisao(payload) {
    const resultado = await dividirLeadLinhas(payload);
    if (!resultado?.requires_manual_allocation) {
      setSucesso('Leads enviados para os vendedores.');
      setSelecionadas([...selecionadas]);
    }
    return resultado;
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

      {modalDividir && (
        <DividirModal
          linhas={linhasFiltradas}
          colunas={colunasDivisao}
          vendedoras={vendedoras}
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
              <button
                key={planilha.id}
                type="button"
                className={`lead-doc-card ${selecionadas.includes(planilha.id) ? 'active' : ''}`}
                onClick={() => togglePlanilha(planilha.id)}
              >
                <div className="lead-doc-preview">
                  <span></span><span></span><span></span><span></span>
                </div>
                <strong title={planilha.nome}>{planilha.nome}</strong>
                <small>{planilha.total_linhas} linhas</small>
              </button>
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
          <button className="btn" type="button" onClick={() => baixarCsv('leads.csv', colunas, linhasFiltradas)} disabled={linhasFiltradas.length === 0}>
            Exportar CSV
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setModalDividir(true)} disabled={linhasFiltradas.length === 0}>
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

        {sucesso && <div className="alert-success alert-timed alert-timed--success">{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}
        {processando && <div className="lead-processing">{processando}</div>}

        <div className="lead-results-meta">
          {linhasFiltradas.length} lead(s) exibidos de {linhas.length} carregados
        </div>

        <div className="list-table lead-table">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Planilha</th>
                  {colunas.map(coluna => <th key={coluna.id}>{coluna.label}</th>)}
                  <th>Atribuido</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr><td colSpan={colunas.length + 2} className="muted">Carregando...</td></tr>
                ) : linhasPagina.length === 0 ? (
                  <tr><td colSpan={colunas.length + 2} className="muted">Selecione uma planilha para visualizar os leads.</td></tr>
                ) : (
                  linhasPagina.map(linha => (
                    <tr key={linha.id}>
                      <td><span className="tag">{linha.planilha?.nome || '-'}</span></td>
                      {colunas.map(coluna => <td key={coluna.id}>{getValorColuna(linha, coluna) || '-'}</td>)}
                      <td>{linha.atribuidoPara?.nome || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lead-pagination">
          <button className="btn" type="button" disabled={pagina <= 1} onClick={() => setPagina(prev => Math.max(1, prev - 1))}>Anterior</button>
          <span>Pagina {pagina} de {totalPaginas}</span>
          <button className="btn" type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(prev => Math.min(totalPaginas, prev + 1))}>Proxima</button>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default AdminLeadsPage;
