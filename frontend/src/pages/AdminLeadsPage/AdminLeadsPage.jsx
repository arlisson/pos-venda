import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import * as I from '../../components/Icons';
import DocProgresso from '../../components/DocProgresso';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { calcularProgresso } from '../../utils/progresso';
import { listarVendedoras } from '../../services/venda.service';
import {
  atualizarLeadSchema,
  criarLeadPlanilha,
  dividirLeadLinhas,
  excluirLeadPlanilha,
  exportarLeadLinhas,
  finalizarLeadPlanilha,
  importarLeadPlanilhaExcel,
  listarLeadLinhas,
  listarLeadPlanilhas,
  marcarErroLeadPlanilha,
  salvarLeadLinhas
} from '../../services/lead-planilha.service';
import { previewPlanilhaClientesAntigos } from '../../services/cliente-antigo.service';
import './AdminLeadsPage.css';

const MAPEAMENTO_CLIENTES_ANTIGOS = {
  cnpj: '',
  razao_social: '',
  data_venda: '',
  operadora: '',
  responsavel_nome: '',
  telefone: '',
  quantidade_chips: ''
};
const PAGE_SIZE = 200;
const OPS = {
  string: [
    ['contains', 'Contém'],
    ['exact', 'Exato'],
    ['starts', 'Comeca com'],
    ['ends', 'Termina com']
  ],
  number: [
    ['contains', 'Contém'],
    ['exact', 'Exato'],
    ['starts', 'Comeca com'],
    ['ends', 'Termina com']
  ],
  date: [
    ['exact', 'Data exata'],
    ['between', 'De/ate']
  ]
};

/**
 * Normaliza texto para uso interno consistente.
 */
function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Calcula o progresso de envio (enviados x pendentes) de uma planilha.
 */
function calcularProgressoEnvio(planilha) {
  return calcularProgresso(planilha?.total_linhas, planilha?.total_enviados);
}

/**
 * Retorna valor coluna a partir dos dados informados.
 */
function normalizarColunaImportacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokensBuscaColuna(valor) {
  return normalizarColunaImportacao(valor)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function colunaCorrespondeBusca(coluna, busca) {
  const termo = normalizarColunaImportacao(busca);
  const nome = normalizarColunaImportacao(coluna?.nome);
  if (!termo || !nome) return false;
  if (nome === termo || nome.includes(termo)) return true;

  const tokens = tokensBuscaColuna(busca);
  return tokens.length > 0 && tokens.every(token => nome.includes(token));
}

function encontrarColunaImportacao(colunas, busca) {
  if (!busca) return null;
  return colunas.find(coluna => colunaCorrespondeBusca(coluna, busca)) || null;
}

function sugerirColunaImportacao(colunas, termos) {
  return termos.map(termo => encontrarColunaImportacao(colunas, termo)).find(Boolean)?.nome || '';
}

function montarSugestoesClientesAntigos(colunas) {
  return {
    cnpj: sugerirColunaImportacao(colunas, ['cnpj', 'cpf/cnpj', 'documento']),
    razao_social: sugerirColunaImportacao(colunas, ['razao', 'razao social', 'empresa']),
    data_venda: sugerirColunaImportacao(colunas, ['data da venda', 'data venda', 'data']),
    operadora: sugerirColunaImportacao(colunas, ['operadora', 'operadoras']),
    responsavel_nome: sugerirColunaImportacao(colunas, ['responsavel', 'nome responsavel', 'nome do responsavel', 'contato']),
    telefone: sugerirColunaImportacao(colunas, ['terminal', 'telefone', 'fone', 'celular', 'whatsapp', 'contato telefone']),
    quantidade_chips: sugerirColunaImportacao(colunas, ['quantidade de chips', 'qtd chips', 'chips', 'quantidade', 'qtd', 'ctns'])
  };
}
function getValorColuna(linha, coluna) {
  if (!coluna) return '';
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return linha.dados_json?.[source?.nome || coluna.nome] ?? '';
}

/**
 * Retorna status distribuicao a partir dos dados informados.
 */
function getStatusDistribuicao(linha) {
  return linha.atribuido_para_id || linha.atribuidoPara || linha.envio_id || linha.envio
    ? 'Enviado'
    : 'Não enviado';
}

function isLeadVendaRecusada(linha) {
  return Boolean(linha?.status_operacional === 'perdido' || linha?.venda_recusada_em || linha?.venda_recusada_motivo);
}

/**
 * Formata numero para exibicao ou envio.
 */
function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

/**
 * Retorna conflitos colunas a partir dos dados informados.
 */
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

/**
 * Monta filtros backend a partir dos dados informados.
 */
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

/**
 * Renderiza dividir modal.
 */
function DividirModal({ totalLinhas, resumoLeads, colunas, vendedoras, filtrosDivisao, onClose, onSave }) {
  const [nome, setNome] = useState(`Envio ${new Date().toLocaleDateString('pt-BR')}`);
  const [usuarios, setUsuarios] = useState([]);
  const [quantidade, setQuantidade] = useState(String(totalLinhas));
  const [colunasVisiveis, setColunasVisiveis] = useState(colunas);
  const [manual, setManual] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [incluirEnviados, setIncluirEnviados] = useState(false);
  const [etapa, setEtapa] = useState('sondagem');
  const [disponiveisVenda, setDisponiveisVenda] = useState(null);
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);

  useEffect(() => {
    if (etapa !== 'venda') return;
    let cancelado = false;
    setCarregandoDisponiveis(true);
    listarLeadLinhas({
      ...filtrosDivisao,
      filters: JSON.stringify(filtrosDivisao?.filters || []),
      somente_qualificados: true,
      disponivel_venda: true,
      page: 1,
      page_size: 1
    })
      .then(resultado => {
        if (cancelado) return;
        const total = Number(resultado?.total || 0);
        setDisponiveisVenda(total);
        setQuantidade(String(total));
      })
      .catch(error => {
        if (!cancelado) setErro(error.message || 'Erro ao contar futuros clientes disponiveis.');
      })
      .finally(() => { if (!cancelado) setCarregandoDisponiveis(false); });
    return () => { cancelado = true; };
  }, [etapa, filtrosDivisao]);

  /**
   * Alterna usuario no estado atual.
   */
  function toggleUsuario(id) {
    setUsuarios(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }

  /**
   * Executa a acao de mover coluna mantendo o estado da tela consistente.
   */
  function moverColuna(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= colunasVisiveis.length) return;
    const proximas = [...colunasVisiveis];
    const [item] = proximas.splice(index, 1);
    proximas.splice(novoIndex, 0, item);
    setColunasVisiveis(proximas);
  }

  /**
   * Envia o formulario para processamento.
   */
  async function submit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const resultado = await onSave({
        nome,
        quantidade_total: Number(quantidade),
        usuario_ids: usuarios,
        filtros: etapa === 'venda'
          ? { ...filtrosDivisao, somente_qualificados: true, disponivel_venda: true }
          : filtrosDivisao,
        colunas_visiveis: colunasVisiveis,
        incluir_enviados: incluirEnviados,
        etapa,
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
  const capacidadeAtual = etapa === 'venda'
    ? Number(disponiveisVenda || 0)
    : (incluirEnviados ? totalResumo : disponiveisPadrao);
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
              <label>Etapa do envio</label>
              <select value={etapa} onChange={event => {
                setEtapa(event.target.value);
                if (event.target.value === 'venda') setIncluirEnviados(true);
              }}>
                <option value="sondagem">Primeira ligacao / sondagem</option>
                <option value="venda">Futuros clientes / venda</option>
              </select>
            </div>
            <div className="form-field">
              <label>Quantidade</label>
              <input type="number" min="1" max={capacidadeAtual || 1} value={quantidade} onChange={event => setQuantidade(event.target.value)} required disabled={carregandoDisponiveis} />
            </div>
          </div>

          <div className="leads-divide-summary">
            <div>
              <span>Disponíveis agora</span>
              <strong>{formatarNumero(disponiveisPadrao)}</strong>
            </div>
            <div>
              <span>Já enviados</span>
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
            {etapa === 'venda'
              ? (carregandoDisponiveis
                ? 'Contando futuros clientes qualificados e disponiveis...'
                : `${formatarNumero(capacidadeAtual)} futuro(s) cliente(s) qualificado(s) estao disponiveis para esta distribuicao.`)
              : incluirEnviados
              ? `Este envio pode usar mailing novo e transferir até ${formatarNumero(Math.min(vaiTransferir, jaEnviados))} registro(s) já enviados.`
              : 'O envio automático começa no próximo registro ainda não enviado e ignora os mailing já distribuídos.'}
          </div>

          <label className="leads-transfer-toggle">
            <input
              type="checkbox"
              checked={incluirEnviados}
              onChange={event => setIncluirEnviados(event.target.checked)}
              disabled={etapa === 'venda'}
            />
            <span>
              <strong>Incluir mailing já enviados</strong>
              <small>Use para transferir mailing que já foram enviados para outro vendedor.</small>
            </span>
          </label>

          {incluirEnviados && (
            <div className="leads-warning">
              Mailing já enviados que entrarem nesta divisão serão transferidos para o novo vendedor e novo envio.
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
              A divisão deixou {manual.sobra} cliente(s) sobrando. Distribua manualmente a sobra abaixo. Base: {manual.base} por vendedor.
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
          <button type="submit" className="btn btn-primary" disabled={salvando || carregandoDisponiveis || quantidadeNumerica <= 0 || quantidadeNumerica > capacidadeAtual || usuarios.length === 0 || colunasVisiveis.length === 0}>
            {salvando ? 'Enviando...' : 'Enviar mailing'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Renderiza mesclar colunas modal.
 */
function MesclarColunasModal({ grupos, defaultSelecionadas, onClose, onConfirm }) {
  const [selecionadas, setSelecionadas] = useState(defaultSelecionadas);

  /**
   * Alterna  no estado atual.
   */
  function toggle(chave) {
    setSelecionadas(prev => (
      prev.includes(chave)
        ? prev.filter(item => item !== chave)
        : [...prev, chave]
    ));
  }

  /**
   * Seleciona todas e atualiza o estado relacionado.
   */
  function selecionarTodas() {
    setSelecionadas(grupos.map(grupo => grupo.chave));
  }

  /**
   * Limpa todas e restaura o estado inicial.
   */
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

/**
 * Renderiza excluir planilha modal.
 */
function ExcluirPlanilhaModal({ planilha, carregando, erro, onClose, onConfirm }) {
  if (!planilha) return null;

  return (
    <div className="modal-overlay">
      <div className="modal leads-delete-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Excluir planilha?</div>
              <div className="modal-sub">Essa ação remove a planilha, suas linhas importadas e o mailing enviado aos usuários.</div>
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
              <span>{planilha.total_linhas || 0} {(planilha.total_linhas || 0) === 1 ? 'linha' : 'linhas'}</span>
              <small>Se houver mailing distribuído, ele deixará de aparecer para os vendedores.</small>
              {planilha.status === 'processando' && (
                <small>A planilha ainda está processando e o backend vai bloquear a exclusão.</small>
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

/**
 * Renderiza admin leads page.
 */
function AdminLeadsPage() {
  const inputRef = useRef(null);
  const [planilhas, setPlanilhas] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [resumoLeads, setResumoLeads] = useState({ total: 0, enviados: 0, qualificados: 0, nao_enviados: 0 });
  const [vendedoras, setVendedoras] = useState([]);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
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
  const [caArquivo, setCaArquivo] = useState(null);
  const [caPreview, setCaPreview] = useState(null);
  const [caMapeamento, setCaMapeamento] = useState(MAPEAMENTO_CLIENTES_ANTIGOS);
  const [caCarregandoPreview, setCaCarregandoPreview] = useState(false);
  const [caImportando, setCaImportando] = useState(false);
  const [caResultado, setCaResultado] = useState(null);
  const [caAbasSelecionadas, setCaAbasSelecionadas] = useState([]);
  const [abaMailing, setAbaMailing] = useState('mailing');

  /**
   * Carrega base e atualiza o estado relacionado.
   */
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
      setResumoLeads({ total: 0, enviados: 0, qualificados: 0, nao_enviados: 0 });
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarLeadLinhas({
      planilha_ids: selecionadas,
      page: pagina,
      page_size: PAGE_SIZE,
      busca: buscaDeferred,
      filters: JSON.stringify(filtrosBackend)
    })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotalLinhas(data.total || 0);
          setResumoLeads(data.resumo || {
            total: data.total || 0,
            enviados: 0,
            qualificados: 0,
            nao_enviados: data.total || 0
          });
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar linhas.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [selecionadas, pagina, buscaDeferred, filtrosBackend]);
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

  const caColunasSelecionadas = useMemo(() => {
    const abasComColunas = caPreview?.abas?.filter(item => Array.isArray(item.colunas)) || [];
    const selecionadasSet = new Set(caAbasSelecionadas);
    const origem = abasComColunas.length > 0
      ? abasComColunas.filter(item => selecionadasSet.has(item.nome)).flatMap(item => item.colunas || [])
      : caPreview?.colunas || [];
    const vistas = new Set();

    return origem.filter(coluna => {
      if (!coluna?.nome || vistas.has(coluna.nome)) return false;
      vistas.add(coluna.nome);
      return true;
    });
  }, [caPreview, caAbasSelecionadas]);

  const caCnpjSelecionadoValido = useMemo(() => (
    Boolean(caMapeamento.cnpj && encontrarColunaImportacao(caColunasSelecionadas, caMapeamento.cnpj))
  ), [caMapeamento.cnpj, caColunasSelecionadas]);

  async function caCarregarPreview(file) {
    setCaArquivo(file || null);
    setCaPreview(null);
    setCaResultado(null);
    setCaMapeamento(MAPEAMENTO_CLIENTES_ANTIGOS);
    setCaAbasSelecionadas([]);
    setErro('');
    setSucesso('');

    if (!file) return;

    setCaCarregandoPreview(true);
    try {
      const data = await previewPlanilhaClientesAntigos(file);
      setCaPreview(data);
      setCaAbasSelecionadas((data.abas || []).map(item => item.nome));
      setCaMapeamento({
        cnpj: data.sugestoes?.cnpj || '',
        razao_social: data.sugestoes?.razao_social || '',
        data_venda: data.sugestoes?.data_venda || '',
        operadora: data.sugestoes?.operadora || '',
        responsavel_nome: data.sugestoes?.responsavel_nome || '',
        telefone: data.sugestoes?.telefone || '',
        quantidade_chips: data.sugestoes?.quantidade_chips || ''
      });
    } catch (error) {
      setErro(error.message || 'Erro ao ler planilha.');
    } finally {
      setCaCarregandoPreview(false);
    }
  }

  function caToggleTodasAbas(marcar) {
    setCaAbasSelecionadas(marcar ? (caPreview?.abas || []).map(item => item.nome) : []);
  }

  function caToggleAba(nome) {
    setCaAbasSelecionadas(prev => (
      prev.includes(nome)
        ? prev.filter(item => item !== nome)
        : [...prev, nome]
    ));
  }

  useEffect(() => {
    if (!caPreview) return;

    const sugestoes = montarSugestoesClientesAntigos(caColunasSelecionadas);
    setCaMapeamento(prev => {
      const proximo = { ...prev };
      Object.keys(proximo).forEach(campo => {
        if (proximo[campo] && !encontrarColunaImportacao(caColunasSelecionadas, proximo[campo])) {
          proximo[campo] = sugestoes[campo] || '';
        }
      });
      if (!proximo.cnpj && sugestoes.cnpj) proximo.cnpj = sugestoes.cnpj;
      return proximo;
    });
  }, [caPreview, caColunasSelecionadas]);

  async function caImportar() {
    if (!caArquivo || caImportando) return;
    if (caAbasSelecionadas.length === 0) {
      setErro('Selecione ao menos uma aba para importar.');
      return;
    }
    if (!caCnpjSelecionadoValido) {
      setErro('Selecione a coluna que contem o CNPJ nas abas marcadas.');
      return;
    }

    setCaImportando(true);
    setProcessando(`Importando mailing e base antiga ${caArquivo.name}`);
    setErro('');
    setSucesso('');
    setCaResultado(null);

    try {
      const data = await importarLeadPlanilhaExcel(caArquivo, progresso => {
        setProcessando(`Importando mailing e base antiga ${caArquivo.name}: ${progresso}%`);
      }, {
        baseAntiga: true,
        mapeamento: caMapeamento,
        abas: caAbasSelecionadas
      });
      setCaResultado(data.base_antiga || null);
      await carregarBase();
      const totalPlanilhas = data.planilhas?.length || caAbasSelecionadas.length;
      const base = data.base_antiga;
      setSucesso(`Importacao concluida: ${totalPlanilhas} planilha(s) de mailing e ${base?.inseridos || 0} novo(s) na base antiga.`);
    } catch (error) {
      setErro(error.message || 'Erro ao importar planilha.');
    } finally {
      setCaImportando(false);
      setProcessando('');
    }
  }
  /**
   * Importa arquivo a partir dos dados recebidos.
   */
  async function importarArquivo(file) {
    const nome = file.name.toLowerCase();
    const ehCsv = nome.endsWith('.csv');
    const ehXlsx = nome.endsWith('.xlsx');

    if (!ehCsv && !ehXlsx) {
      throw new Error('Envie arquivos .csv ou .xlsx.');
    }

    setProcessando(`Preparando ${file.name}`);
    setErro('');

    if (ehXlsx) {
      await importarLeadPlanilhaExcel(file, progresso => {
        setProcessando(`Enviando ${file.name}: ${progresso}%`);
      });
      return;
    }

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

      /**
       * Atualiza import status com o estado mais recente.
       */
      function updateImportStatus() {
        setProcessando(`Parseando ${parsedProgress}% | Enviando lote ${sentBatches}/${Math.max(totalBatches, sentBatches)}`);
      }

      /**
       * Finaliza o processamento informando o erro ocorrido.
       */
      function finishWithError(error) {
        if (rejected) return;
        rejected = true;
        worker.terminate();
        marcarErroLeadPlanilha(planilha.id, error.message || 'Erro ao importar CSV.').catch(() => {});
        reject(error);
      }

      /**
       * Processa send batch conforme as regras do dominio.
       */
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

      /**
       * Tenta finalizar o processamento quando todas as pendencias terminam.
       */
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

      /**
       * Processa a fila respeitando o limite de concorrencia.
       */
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

  /**
   * Trata o evento de upload.
   */
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

  /**
   * Alterna planilha no estado atual.
   */
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

  /**
   * Aplica mesclagem colunas sobre a consulta ou conjunto informado.
   */
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

  /**
   * Adiciona filtro ao conjunto atual.
   */
  function adicionarFiltro() {
    if (!novoFiltro.coluna) return;
    setFiltros(prev => [...prev, { ...novoFiltro, id: crypto.randomUUID() }]);
    setNovoFiltro({ coluna: novoFiltro.coluna, op: 'contains', valor: '', valor2: '' });
    setPagina(1);
  }

  /**
   * Exporta csv backend no formato esperado.
   */
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

  /**
   * Executa a acao de alterar tipo mantendo o estado da tela consistente.
   */
  async function alterarTipo(planilha, coluna, tipo) {
    const schemaAtualizado = {
      ...(planilha.schema_colunas || {}),
      [coluna]: tipo
    };
    const atualizada = await atualizarLeadSchema(planilha.id, schemaAtualizado);
    setPlanilhas(prev => prev.map(item => item.id === planilha.id ? atualizada : item));
  }

  /**
   * Salva divisao com os dados informados.
   */
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
        ? `Mailing enviado. ${resultado.total_reenviados} registro(s) já enviados foram transferidos.`
        : 'Mailing enviado para os vendedores.');
      setSelecionadas([...selecionadas]);
    }
    return resultado;
  }

  /**
   * Executa a acao de confirmar exclusao planilha mantendo o estado da tela consistente.
   */
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
      setSucesso('Planilha excluída com sucesso.');
    } catch (error) {
      const mensagem = error.message || 'Erro ao excluir planilha.';
      setErroExclusao(mensagem);
      setErro(mensagem);
    } finally {
      setExcluindoId(null);
    }
  }

  /**
   * Retorna tipo coluna por id a partir dos dados informados.
   */
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

  function renderClientesAntigosMailing() {
    const colunasAntigas = caColunasSelecionadas;
    const abasPlanilha = caPreview?.abas || [];
    const totalLinhasSelecionadas = abasPlanilha
      .filter(item => caAbasSelecionadas.includes(item.nome))
      .reduce((soma, item) => soma + Number(item.linhas || 0), 0);
    const todasAbasSelecionadas = abasPlanilha.length > 0 && caAbasSelecionadas.length === abasPlanilha.length;
    const campos = [
      { chave: 'cnpj', label: 'CNPJ', obrigatorio: true },
      { chave: 'razao_social', label: 'Razao social', obrigatorio: false },
      { chave: 'data_venda', label: 'Data da venda', obrigatorio: false },
      { chave: 'operadora', label: 'Operadora', obrigatorio: false },
      { chave: 'responsavel_nome', label: 'Nome do responsavel', obrigatorio: false },
      { chave: 'telefone', label: 'Terminal', obrigatorio: false },
      { chave: 'quantidade_chips', label: 'Quantidade de chips', obrigatorio: false }
    ];

    return (
      <div className="clientes-antigos-config lead-old-import-panel">
        <div className="panel-header">
          <div>
            <h2>Base de clientes antigos + mailing</h2>
            <p>Envie uma planilha .xlsx, escolha as abas, mapeie as colunas e importe. Cada aba selecionada vira uma planilha de mailing separada e tambem alimenta a base de clientes antigos.</p>
          </div>
        </div>

        <div className="cliente-import-controls">
          <div className="form-field">
            <label>Arquivo .xlsx</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={event => caCarregarPreview(event.target.files?.[0])}
              disabled={caCarregandoPreview || caImportando || Boolean(processando)}
            />
          </div>
        </div>

        {caCarregandoPreview && <div className="muted">Lendo planilha...</div>}

        {caPreview && (
          <>
            <div className="cliente-import-summary">
              <span>Arquivo: <strong>{caPreview.arquivo}</strong></span>
              <span>Abas: <strong>{caPreview.total_abas || 1}</strong></span>
              <span>Linhas selecionadas: <strong>{totalLinhasSelecionadas}</strong></span>
              <span>Colunas: <strong>{colunasAntigas.length}</strong></span>
            </div>

            {abasPlanilha.length > 0 && (
              <div className="clientes-antigos-abas">
                <div className="clientes-antigos-abas-header">
                  <div>
                    <strong>Abas para importar</strong>
                    <p>O mesmo mapeamento sera usado nas abas selecionadas. No mailing, cada aba marcada vira uma planilha separada.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => caToggleTodasAbas(!todasAbasSelecionadas)}
                    disabled={caImportando}
                  >
                    {todasAbasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>
                <div className="clientes-antigos-abas-lista">
                  {abasPlanilha.map(item => (
                    <label key={item.nome} className="clientes-antigos-aba-option">
                      <input
                        type="checkbox"
                        checked={caAbasSelecionadas.includes(item.nome)}
                        onChange={() => caToggleAba(item.nome)}
                        disabled={caImportando}
                      />
                      <span>{item.nome}</span>
                      <small>{item.linhas} linha(s)</small>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="cliente-import-mapeamento">
              {campos.map(campo => (
                <div className="form-field" key={campo.chave}>
                  <label>{campo.label}{campo.obrigatorio ? ' *' : ''}</label>
                  <input
                    type="text"
                    list={`mailing-clientes-antigos-colunas-${campo.chave}`}
                    value={caMapeamento[campo.chave]}
                    onChange={event => setCaMapeamento(prev => ({ ...prev, [campo.chave]: event.target.value }))}
                    placeholder={campo.chave === 'operadora' ? 'Ex.: operadora ou Claro' : (campo.obrigatorio ? 'Ex.: cnpj' : 'Ex.: data ativacao')}
                    disabled={caImportando}
                  />
                  <datalist id={`mailing-clientes-antigos-colunas-${campo.chave}`}>
                    {colunasAntigas.map(coluna => (
                      <option key={`${campo.chave}:${coluna.nome}:${coluna.index}`} value={coluna.nome} />
                    ))}
                  </datalist>
                  {caMapeamento[campo.chave] && encontrarColunaImportacao(colunasAntigas, caMapeamento[campo.chave]) && (
                    <small>Encontrada: {encontrarColunaImportacao(colunasAntigas, caMapeamento[campo.chave])?.nome}</small>
                  )}
                </div>
              ))}
            </div>

            <div className="config-form-actions lead-old-import-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={caImportar}
                disabled={!caCnpjSelecionadoValido || caImportando || caAbasSelecionadas.length === 0}
              >
                <I.Upload size={14} />
                {caImportando ? 'Importando...' : 'Importar mailing e base antiga'}
              </button>
            </div>
          </>
        )}

        {caResultado && (
          <>
            <div className="cliente-import-summary">
              <span>Total de linhas: <strong>{caResultado.total}</strong></span>
              <span>Vendas validas: <strong>{caResultado.unicos ?? ((caResultado.inseridos || 0) + (caResultado.atualizados || 0))}</strong></span>
              <span>Novos: <strong>{caResultado.inseridos}</strong></span>
              <span>Atualizados: <strong>{caResultado.atualizados}</strong></span>
              <span>Importados sem CNPJ: <strong>{caResultado.sem_cnpj || 0}</strong></span>
              <span>Invalidos ignorados: <strong>{caResultado.invalidos ?? caResultado.ignorados}</strong></span>
            </div>

            {caResultado.invalidos_detalhes?.length > 0 && (
              <div className="cliente-import-invalidos">
                <h4>Linhas ignoradas</h4>
                {caResultado.invalidos > caResultado.invalidos_detalhes.length && (
                  <p className="cliente-import-invalidos-aviso">
                    Mostrando as primeiras {caResultado.invalidos_detalhes.length} de {caResultado.invalidos} linhas ignoradas.
                  </p>
                )}
                <div className="cliente-import-invalidos-tabela">
                  <table>
                    <thead>
                      <tr>
                        <th>Aba</th>
                        <th>Linha</th>
                        <th>Valor lido</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caResultado.invalidos_detalhes.map(item => (
                        <tr key={`${item.aba}:${item.linha}`}>
                          <td>{item.aba}</td>
                          <td>{item.linha}</td>
                          <td>{item.valor || <em>(celula vazia)</em>}</td>
                          <td>{item.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
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

      <div className={`admin-leads-page is-${abaMailing}-tab`}>
                <input ref={inputRef} type="file" accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple hidden onChange={handleUpload} />

        <div className="lead-page-tabs" role="tablist" aria-label="Secoes de mailing">
          <button
            type="button"
            role="tab"
            aria-selected={abaMailing === 'mailing'}
            className={abaMailing === 'mailing' ? 'active' : ''}
            onClick={() => setAbaMailing('mailing')}
          >
            Mailing
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaMailing === 'antigos'}
            className={abaMailing === 'antigos' ? 'active' : ''}
            onClick={() => setAbaMailing('antigos')}
          >
            Clientes antigos
          </button>
        </div>

        <div className="lead-doc-strip">
          <div className="lead-doc-strip__title">
            <span>Planilhas</span>
            <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(processando)}>
              <I.Plus size={14} /> Importar somente mailing
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
                >
                  <I.Trash size={14} />
                </button>
                <div className="lead-doc-preview">
                  <span></span><span></span><span></span><span></span>
                  <i
                    className="lead-doc-preview__progress"
                    style={{ '--progresso-envio': `${calcularProgressoEnvio(planilha).percentual}%` }}
                    aria-hidden="true"
                  ></i>
                </div>
                <strong title={planilha.nome}>{planilha.nome}</strong>
                <small>
                  {planilha.status === 'processando'
                    ? 'Processando...'
                    : `${planilha.total_linhas} ${planilha.total_linhas === 1 ? 'cliente' : 'clientes'}`}
                </small>
                {planilha.status !== 'processando' && (
                  <DocProgresso
                    {...calcularProgressoEnvio(planilha)}
                    rotulo="enviados"
                    rotuloCompleto="Tudo enviado"
                  />
                )}
              </div>
            ))}

            {!carregando && planilhas.length === 0 && (
              <div className="lead-doc-empty">Nenhuma planilha importada.</div>
            )}
          </div>
        </div>

        {renderClientesAntigosMailing()}

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
                {colunas.find(coluna => coluna.id === filtro.coluna)?.label || filtro.coluna}: {filtro.valor}{filtro.valor2 ? ` até ${filtro.valor2}` : ''} x
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
                        <option value="number">Número</option>
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
          {totalLinhas} {totalLinhas === 1 ? 'registro encontrado' : 'registros encontrados'}
        </div>

        {resumoLeads.total > 0 && (
          <div className="lead-summary-panel">
            <div className="lead-summary-card">
              <span>Total filtrado</span>
              <strong>{formatarNumero(resumoLeads.total)}</strong>
            </div>
            <div className="lead-summary-card sent">
              <span>Mailing enviado</span>
              <strong>{formatarNumero(resumoLeads.enviados)}</strong>
            </div>
            <div className="lead-summary-card qualified">
              <span>Qualificados</span>
              <strong>{formatarNumero(resumoLeads.qualificados)}</strong>
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

        <div className="list-table lead-table list-table--scroll-mobile">
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
                  <tr><td colSpan={colunas.length + 4} className="muted">Selecione uma planilha para visualizar o mailing.</td></tr>
                ) : (
                  linhasPagina.map(linha => (
                    <tr
                      key={linha.id}
                      className={
                        isLeadVendaRecusada(linha)
                          ? 'lead-admin-row-refused'
                          : (linha.venda_id || linha.status_operacional === 'vendido' || linha.possui_venda_cliente ? 'lead-admin-row-sold' : '')
                      }
                    >
                      <td><span className="tag">{linha.planilha?.nome || '-'}</span></td>
                      <td>
                        <div className="lead-status-stack">
                          <span className={`lead-send-status ${getStatusDistribuicao(linha) === 'Enviado' ? 'sent' : 'pending'}`}>
                            {getStatusDistribuicao(linha)}
                          </span>
                          {Boolean(linha.futuro_cliente) && !linha.futuro_cliente_excluido_em && (
                            <span className="lead-send-status qualified" title="Qualificado para venda">Qualificado venda</span>
                          )}
                          {(Boolean(linha.venda_id) || linha.status_operacional === 'vendido' || linha.possui_venda_cliente) && (
                            <span className="lead-send-status sold" title="Este futuro cliente possui uma venda vinculada">Venda registrada</span>
                          )}
                          {isLeadVendaRecusada(linha) && (
                            <span className="lead-send-status refused" title={linha.venda_recusada_motivo ? `Motivo: ${linha.venda_recusada_motivo}` : 'Venda recusada'}>
                              Venda recusada
                            </span>
                          )}
                        </div>
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
