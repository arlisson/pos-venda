import { Fragment, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarCampoLeadRecebido,
  excluirFuturoCliente,
  excluirFuturoClienteDefinitivo,
  exportarMetricasFuturosClientesExcel,
  listarFuturosClientesLeads,
  listarFuturosClientesLixeira,
  listarQuadroFuturosClientes,
  listarMetricasFuturosClientes,
  listarMeusLeadEnvios,
  listarMinhasLeadLinhas,
  marcarFuturoClienteLead,
  restaurarFuturoCliente
} from '../../services/lead-planilha.service';
import { formatDateValue, formatUtcDateTime, parseUtcDateTime, toLocalDateTimeInputFromUtc } from '../../utils/datetime';
import { listarOperadoras } from '../../services/config.service';
import './FuturosClientesPage.css';

// ─── Helpers de colunas de lead ──────────────────────────────────────────────

/**
 * Normaliza texto lead para uso interno consistente.
 */
function normalizarTextoLead(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Retorna valor lead recebido a partir dos dados informados.
 */
function getValorLeadRecebido(linha, coluna) {
  if (!coluna) return '';
  if (coluna.atualizada) {
    const colunaBase = getNomeColunaLeadRecebido(linha, coluna.base);
    return colunaBase ? linha.dados_json?.[`${colunaBase} (atualizado)`] ?? '' : '';
  }
  if (typeof coluna === 'string') return linha.dados_json?.[coluna] ?? '';
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';
  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return linha.dados_json?.[source?.nome || coluna.nome] ?? '';
}

/**
 * Retorna nome coluna lead recebido a partir dos dados informados.
 */
function getNomeColunaLeadRecebido(linha, coluna) {
  if (!coluna) return '';
  if (typeof coluna === 'string') return coluna;
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';
  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return source?.nome || coluna.nome || coluna.label || '';
}

/**
 * Retorna label coluna lead recebido a partir dos dados informados.
 */
function getLabelColunaLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.label || coluna?.nome || '';
}

/**
 * Retorna coluna key lead recebido a partir dos dados informados.
 */
function getColunaKeyLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.id || coluna?.nome || coluna?.label || '';
}

/**
 * Cria coluna atualizada lead recebido com os dados informados.
 */
function criarColunaAtualizadaLeadRecebido(coluna) {
  const key = getColunaKeyLeadRecebido(coluna);
  const nome = typeof coluna === 'string' ? coluna : coluna?.nome || coluna?.label || '';
  const sources = Array.isArray(coluna?.sources)
    ? coluna.sources.map(source => ({ ...source, nome: `${source.nome} (atualizado)` }))
    : coluna?.sources;

  return {
    ...(typeof coluna === 'string' ? {} : coluna),
    id: `${key}::updated`,
    nome: `${nome} (atualizado)`,
    label: `${getLabelColunaLeadRecebido(coluna)} (atualizado)`,
    sources,
    atualizada: true,
    base: coluna
  };
}

/**
 * Verifica se linha tem coluna atualizada atende a condicao esperada.
 */
function linhaTemColunaAtualizada(linhas, coluna) {
  return linhas.some(linha => {
    const nome = getNomeColunaLeadRecebido(linha, coluna);
    return nome && Object.prototype.hasOwnProperty.call(linha.dados_json || {}, `${nome} (atualizado)`);
  });
}

/**
 * Retorna valor lead por nome a partir dos dados informados.
 */
function getValorLeadPorNome(linha, nomeColuna) {
  if (!nomeColuna) return '';
  const dados = linha.dados_json || {};
  const nomeAtualizado = `${nomeColuna} (atualizado)`;
  return dados[nomeAtualizado] ?? dados[nomeColuna] ?? '';
}

/**
 * Retorna colunas mapeaveis lead a partir dos dados informados.
 */
function getColunasMapeaveisLead(linha, colunas) {
  const opcoes = new Map();

  colunas.forEach(coluna => {
    if (coluna.atualizada) return;
    const nome = getNomeColunaLeadRecebido(linha, coluna);
    if (!nome || opcoes.has(nome)) return;
    opcoes.set(nome, {
      nome,
      label: getLabelColunaLeadRecebido(coluna),
      valor: getValorLeadPorNome(linha, nome)
    });
  });

  if (opcoes.size === 0) {
    Object.keys(linha.dados_json || {})
      .filter(chave => !chave.endsWith(' (atualizado)'))
      .forEach(chave => opcoes.set(chave, {
        nome: chave,
        label: chave,
        valor: getValorLeadPorNome(linha, chave)
      }));
  }

  return Array.from(opcoes.values());
}

/**
 * Processa sugerir coluna venda conforme as regras do dominio.
 */
function sugerirColunaVenda(campo, opcoes) {
  const aliases = [campo.label, campo.name, ...(campo.aliases || [])].map(normalizarTextoLead);
  const encontrada = opcoes.find(opcao => {
    const label = normalizarTextoLead(opcao.label);
    const nome = normalizarTextoLead(opcao.nome);
    return aliases.some(alias => alias && (label.includes(alias) || nome.includes(alias) || alias.includes(label)));
  });
  return encontrada?.nome || '';
}

const CAMPOS_VENDA_LEAD = [
  { name: 'nome', label: 'Nome', aliases: ['nome', 'name', 'cliente', 'empresa'] },
  { name: 'razao_social', label: 'Razão Social', aliases: ['razao', 'razao social', 'razão social', 'empresa'] },
  { name: 'cnpj', label: 'CNPJ', aliases: ['cnpj', 'cpf', 'documento'] },
  { name: 'telefone', label: 'Celular / Telefone', aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'] },
  { name: 'email', label: 'E-mail', aliases: ['email', 'e-mail', 'correio'] },
  { name: 'responsavel_nome', label: 'Responsável', aliases: ['responsavel', 'responsável', 'contato', 'rep'] }
];

/**
 * Monta cliente preenchido a partir dos dados informados.
 */
function montarClientePreenchido(vendaPreenchida) {
  if (!vendaPreenchida) return null;
  const nome = vendaPreenchida.nome || vendaPreenchida.razao_social || '';
  const cnpj = vendaPreenchida.cnpj || '';
  if (!nome && !cnpj) return null;
  return {
    nome,
    cnpj,
    razao_social: vendaPreenchida.razao_social || '',
    whatsapp: vendaPreenchida.telefone || '',
    email: vendaPreenchida.email || '',
    responsavel_nome: vendaPreenchida.responsavel_nome || '',
    responsavel_tipo: vendaPreenchida.responsavel_tipo || 'rl',
    operadora_atual_id: vendaPreenchida.operadora_atual_id || '',
    quantidade_chips: vendaPreenchida.quantidade_linhas || '',
    valor_pago: vendaPreenchida.valor_mensal_estimado || '',
  };
}

/**
 * Monta venda preenchida do lead a partir dos dados informados.
 */
function montarVendaPreenchidaDoLead(linha, mapeamento, usuario) {
  const sondagem = linha?.sondagem || {};
  const vendedoraId = Number(linha?.atribuido_para_id || usuario?.id || 0);
  const payload = {
    ...(vendedoraId > 0 ? {
      vendedora_id: String(vendedoraId),
      vendedoras: [String(vendedoraId)]
    } : {}),
    ...(sondagem.contato_nome ? { responsavel_nome: sondagem.contato_nome } : {}),
    ...(sondagem.contato_tipo ? { responsavel_tipo: sondagem.contato_tipo } : {}),
    ...(sondagem.operadora_atual_id ? { operadora_atual_id: String(sondagem.operadora_atual_id) } : {}),
    ...(sondagem.quantidade_chips ? { quantidade_linhas: Number(sondagem.quantidade_chips) } : {}),
    ...(sondagem.valor_mensal_estimado ? { valor_mensal_estimado: Number(sondagem.valor_mensal_estimado) } : {}),
    ...(sondagem.whatsapp_ddd ? { telefone: `${sondagem.whatsapp_ddd}${sondagem.whatsapp_numero || ''}` } : {})
  };

  CAMPOS_VENDA_LEAD.forEach(campo => {
    const coluna = mapeamento?.[campo.name];
    const valor = getValorLeadPorNome(linha, coluna);
    if (String(valor || '').trim()) {
      payload[campo.name] = valor;
    }
  });

  return payload;
}

/**
 * Formata data hora para exibicao ou envio.
 */
function formatarDataHora(valor) {
  return formatUtcDateTime(valor, {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }, '-');
}

/**
 * Formata data para exibicao ou envio.
 */
function formatarData(valor) {
  return formatDateValue(valor, undefined, '-');
}

/**
 * Formata valores de data vindos das colunas dinamicas do lead.
 */
function formatarValorCampoLead(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(valor.trim())) {
    return valor;
  }

  return formatarData(valor);
}

/**
 * Verifica se futuro cliente na lixeira atende a condicao esperada.
 */
function isFuturoClienteNaLixeira(linha) {
  return Boolean(linha?.futuro_cliente && linha?.futuro_cliente_excluido_em);
}

/**
 * Verifica se futuro cliente ativo atende a condicao esperada.
 */
function isFuturoClienteAtivo(linha) {
  return Boolean(linha?.futuro_cliente && !linha?.futuro_cliente_excluido_em);
}

function formatarWhatsappInput(valor) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length > 11) digitos = digitos.slice(2);
  digitos = digitos.slice(0, 11);
  if (!digitos) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  if (numero.length <= 8) return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

function encontrarTelefoneLead(linha) {
  const dados = linha?.dados_json || {};
  const prioridades = ['celular', 'whatsapp', 'telefone', 'fone', 'terminal'];
  for (const prioridade of prioridades) {
    const chave = Object.keys(dados)
      .filter(nome => !nome.endsWith(' (atualizado)'))
      .find(nome => normalizarTextoLead(nome) === prioridade);
    if (!chave) continue;
    const valor = dados[`${chave} (atualizado)`] ?? dados[chave];
    if (String(valor || '').replace(/\D/g, '')) return valor;
  }
  return '';
}

function isFuturoClienteVendido(linha) {
  return Boolean(isFuturoClienteAtivo(linha) && (linha?.venda_id || linha?.status_operacional === 'vendido'));
}

function isRetornoFuturoClienteVencido(valor, agora = Date.now()) {
  const retorno = parseUtcDateTime(valor);
  return Boolean(retorno && retorno.getTime() < agora);
}

/**
 * Renderiza lead status no fluxo da tela.
 */
function renderLeadStatus(linha, agora = Date.now()) {
  if (isFuturoClienteNaLixeira(linha)) {
    return (
      <span className="lead-status-cell">
        <span className="pill lead-status-pill muted">Na lixeira</span>
      </span>
    );
  }

  if (isFuturoClienteAtivo(linha)) {
    return (
      <span className="lead-status-cell">
        {isFuturoClienteVendido(linha) && (
          <span className="pill lead-status-pill sold">
            <span className="pill-dot"></span>
            Venda registrada
          </span>
        )}
        <span className="pill success lead-status-pill">
          <span className="pill-dot"></span>
          Futuro cliente
        </span>
        {linha.futuro_cliente_retorno && (
          <span className={`lead-status-return ${isRetornoFuturoClienteVencido(linha.futuro_cliente_retorno, agora) ? 'is-overdue' : ''}`}>
            Retorno: {formatarDataHora(linha.futuro_cliente_retorno)}
          </span>
        )}
      </span>
    );
  }

  return <span className="muted">-</span>;
}

/**
 * Formata para datetime local para exibicao ou envio.
 */
function formatarParaDatetimeLocal(valor) {
  return toLocalDateTimeInputFromUtc(valor);
}

/**
 * Retorna datetime retorno para iso no formato esperado pelo fluxo.
 */
function datetimeRetornoParaIso(valor) {
  if (!valor) return null;

  const data = new Date(valor);
  return isNaN(data.getTime()) ? null : data.toISOString();
}

function criarChipsItensSondagem(sondagem = null) {
  const itens = Array.isArray(sondagem?.chips_itens) ? sondagem.chips_itens : [];
  if (itens.length) return itens.map(item => ({ quantidade: String(item.quantidade || ''), preco_por_chip: String(item.preco_por_chip || '') }));
  if (sondagem?.quantidade_chips || sondagem?.preco_por_chip) {
    return [{ quantidade: String(sondagem.quantidade_chips || ''), preco_por_chip: String(sondagem.preco_por_chip || '') }];
  }
  return [{ quantidade: '', preco_por_chip: '' }];
}

function ChipsItensSondagem({ itens, onChange, disabled }) {
  function atualizar(index, campo, valor) {
    onChange(itens.map((item, itemIndex) => itemIndex === index ? { ...item, [campo]: valor } : item));
  }
  function remover(index) {
    if (itens.length <= 1) return;
    onChange(itens.filter((_, itemIndex) => itemIndex !== index));
  }
  return (
    <div className="chips-sondagem-editor">
      {itens.map((item, index) => (
        <div className="chips-sondagem-row" key={index}>
          <div className="form-field">
            <label>Quantidade de chips</label>
            <input type="number" min="1" step="1" value={item.quantidade} onChange={event => atualizar(index, 'quantidade', event.target.value)} required disabled={disabled} />
          </div>
          <div className="form-field">
            <label>Preco por chip</label>
            <input type="number" min="0.01" step="0.01" value={item.preco_por_chip} onChange={event => atualizar(index, 'preco_por_chip', event.target.value)} required disabled={disabled} />
          </div>
          {itens.length > 1 && (
            <button type="button" className="btn btn-icon btn-ghost chips-sondagem-remove" title="Remover faixa" onClick={() => remover(index)} disabled={disabled}><I.Trash size={14} /></button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-sm chips-sondagem-add" onClick={() => onChange([...itens, { quantidade: '', preco_por_chip: '' }])} disabled={disabled}>
        <I.Plus size={14} /> Adicionar outro valor de chip
      </button>
    </div>
  );
}

// ─── Modal: registrar venda ───────────────────────────────────────────────────

/**
 * Renderiza registrar venda lead modal.
 */
function RegistrarVendaLeadModal({ linha, colunas, usuario, onClose, onConfirm }) {
  const opcoesColunas = useMemo(() => getColunasMapeaveisLead(linha, colunas), [linha, colunas]);
  const [mapeamento, setMapeamento] = useState(() => (
    CAMPOS_VENDA_LEAD.reduce((acc, campo) => ({
      ...acc,
      [campo.name]: sugerirColunaVenda(campo, opcoesColunas)
    }), {})
  ));

  /**
   * Atualiza mapeamento com os dados informados.
   */
  function atualizarMapeamento(campo, valor) {
    setMapeamento(prev => ({ ...prev, [campo]: valor }));
  }

  /**
   * Envia o formulario para processamento.
   */
  function submit(event) {
    event.preventDefault();
    onConfirm(montarVendaPreenchidaDoLead(linha, mapeamento, usuario));
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <form className="modal lead-sale-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Registrar venda</div>
              <div className="modal-sub">Escolha quais colunas vão preencher a nova venda.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="lead-sale-map-head">
            <span>Campo da venda</span>
            <span>Coluna da planilha</span>
            <span>Valor que será levado</span>
          </div>

          <div className="lead-sale-map-list">
            {CAMPOS_VENDA_LEAD.map(campo => {
              const coluna = mapeamento[campo.name] || '';
              const valor = getValorLeadPorNome(linha, coluna);

              return (
                <div key={campo.name} className="lead-sale-map-row">
                  <label>{campo.label}</label>
                  <select value={coluna} onChange={event => atualizarMapeamento(campo.name, event.target.value)}>
                    <option value="">Não preencher</option>
                    {opcoesColunas.map(opcao => (
                      <option key={opcao.nome} value={opcao.nome}>{opcao.label}</option>
                    ))}
                  </select>
                  <span title={valor || ''}>{valor || '-'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Continuar na nova venda</button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal: atualizar campo ───────────────────────────────────────────────────

/**
 * Renderiza lead atualizacao modal.
 */
function LeadAtualizacaoModal({ dados, salvando, erro, onClose, onSave }) {
  const [valor, setValor] = useState(dados?.valorAtualizado || '');

  if (!dados) return null;

  /**
   * Envia o formulario para processamento.
   */
  function submit(event) {
    event.preventDefault();
    onSave(valor);
  }

  return (
    <div className="modal-overlay" onClick={event => !salvando && event.target === event.currentTarget && onClose()}>
      <form className="modal lead-update-modal" onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Atualizar informação</div>
              <div className="modal-sub">{dados.label}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="lead-update-summary">
            <span>Informação original</span>
            <strong>{dados.valorOriginal || '-'}</strong>
          </div>

          <div className="form-field">
            <label>Informação atualizada</label>
            <input
              autoFocus
              value={valor}
              onChange={event => setValor(event.target.value)}
              required
            />
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando || !valor.trim()}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal: adicionar lead (popup intermediário) ──────────────────────────────

/**
 * Renderiza adicionar lead modal.
 */
function AdicionarLeadModal({ linha, colunas, usuario, onClose, onRegistrarVenda, onFuturoClienteSalvo }) {
  const vendaRegistrada = isFuturoClienteVendido(linha);
  const [etapa, setEtapa] = useState('opcoes'); // 'opcoes' | 'venda' | 'futuro'
  const [notas, setNotas] = useState('');
  const [retorno, setRetorno] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [operadoras, setOperadoras] = useState([]);
  const [contatoNome, setContatoNome] = useState('');
  const [contatoTipo, setContatoTipo] = useState('');
  const [operadoraAtualId, setOperadoraAtualId] = useState('');
  const [chipsItens, setChipsItens] = useState(() => criarChipsItensSondagem());
  const [whatsapp, setWhatsapp] = useState(() => formatarWhatsappInput(encontrarTelefoneLead(linha)));
  const valorMensalEstimado = chipsItens.reduce((total, item) => total
    + ((Number(item.quantidade) || 0) * (Number(String(item.preco_por_chip).replace(',', '.')) || 0)), 0);

  useEffect(() => {
    listarOperadoras().then(resultado => setOperadoras(Array.isArray(resultado) ? resultado : resultado?.data || [])).catch(() => setOperadoras([]));
  }, []);

  const camposLead = useMemo(() => {
    const dados = linha.dados_json || {};
    return Object.entries(dados)
      .filter(([chave]) => !chave.endsWith(' (atualizado)'))
      .map(([chave, valor]) => ({
        label: chave,
        valor: dados[`${chave} (atualizado)`] ?? valor
      }));
  }, [linha]);

  /**
   * Salva futuro cliente com os dados informados.
   */
  async function salvarFuturoCliente(event) {
    event.preventDefault();
    setSalvando(true);
    setErro('');

    try {
      const retornoIso = datetimeRetornoParaIso(retorno);
      if (retorno && !retornoIso) {
        setErro('Informe uma data e hora de retorno validas.');
        setSalvando(false);
        return;
      }

      const resultado = await marcarFuturoClienteLead(linha.id, {
        notas,
        retorno: retornoIso,
        contato_nome: contatoNome,
        contato_tipo: contatoTipo,
        operadora_atual_id: Number(operadoraAtualId),
        chips_itens: chipsItens,
        whatsapp
      });
      onFuturoClienteSalvo(resultado.linha);
    } catch (error) {
      setErro(error.message || 'Erro ao registrar futuro cliente.');
      setSalvando(false);
    }
  }

  if (etapa === 'venda') {
    return (
      <RegistrarVendaLeadModal
        linha={linha}
        colunas={colunas}
        usuario={usuario}
        onClose={onClose}
        onConfirm={onRegistrarVenda}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={event => !salvando && event.target === event.currentTarget && onClose()}>
      <div className="modal adicionar-lead-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Adicionar lead</div>
              <div className="modal-sub">{linha.envio?.nome || 'Lead recebido'}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="adicionar-lead-dados">
            {camposLead.map(({ label, valor }) => (
              <div key={label} className="adicionar-lead-campo">
                <span className="adicionar-lead-campo__label">{label}</span>
                <span className="adicionar-lead-campo__valor">{formatarValorCampoLead(valor) || '-'}</span>
              </div>
            ))}
            {camposLead.length === 0 && (
              <div className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>Sem dados disponíveis.</div>
            )}
          </div>

          {etapa === 'opcoes' && (
            <div className="adicionar-lead-acoes">
              {vendaRegistrada ? (
                <div className="lead-already-qualified-notice">
                  Este futuro cliente ja possui uma venda registrada. Acesse a pagina de Vendas para visualizar a venda.
                </div>
              ) : linha.futuro_cliente && (
                <div className="lead-already-qualified-notice">
                  Este contato ja foi qualificado na primeira ligacao. Nesta etapa ele esta disponivel somente para registro de venda.
                </div>
              )}
              {!vendaRegistrada && (
                <button type="button" className="btn btn-primary" onClick={() => setEtapa('venda')}>
                  <I.Chart size={14} /> Registrar venda
                </button>
              )}
              {!linha.futuro_cliente && (
                <button type="button" className="btn" onClick={() => setEtapa('futuro')}>
                  <I.Calendar size={14} /> Registrar futuro cliente
                </button>
              )}
            </div>
          )}

          {etapa === 'futuro' && (
            <form className="futuro-cliente-form" onSubmit={salvarFuturoCliente}>
              <div className="form-field">
                <label>Nome de quem falou</label>
                <input value={contatoNome} onChange={event => setContatoNome(event.target.value)} required disabled={salvando} />
              </div>
              <div className="form-field">
                <label>Perfil do contato</label>
                <select value={contatoTipo} onChange={event => setContatoTipo(event.target.value)} required disabled={salvando}>
                  <option value="">Selecione</option>
                  <option value="adm">ADM</option>
                  <option value="rl">RL</option>
                </select>
              </div>
              <div className="form-field">
                <label>Operadora atual</label>
                <select value={operadoraAtualId} onChange={event => setOperadoraAtualId(event.target.value)} required disabled={salvando}>
                  <option value="">Selecione</option>
                  {operadoras.map(operadora => <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>)}
                </select>
              </div>
              <ChipsItensSondagem itens={chipsItens} onChange={setChipsItens} disabled={salvando} />
              <div className="futuro-cliente-estimativa">
                <span>Media mensal estimada</span>
                <strong>{valorMensalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div className="form-field">
                <label>WhatsApp com DDD</label>
                <input type="tel" inputMode="numeric" maxLength="15" autoComplete="tel" placeholder="(11) 99999-9999" value={whatsapp} onChange={event => setWhatsapp(formatarWhatsappInput(event.target.value))} required disabled={salvando} />
              </div>
              <div className="form-field">
                <label>Notas sobre este cliente</label>
                <textarea
                  rows={3}
                  value={notas}
                  onChange={event => setNotas(event.target.value)}
                  placeholder="Observações, interesses, histórico..."
                  disabled={salvando}
                />
              </div>
              <div className="form-field">
                <label>Data de retorno</label>
                <input
                  type="datetime-local"
                  value={retorno}
                  onChange={event => setRetorno(event.target.value)}
                  disabled={salvando}
                />
              </div>

              {erro && <div className="alert-error" style={{ marginTop: 8 }}>{erro}</div>}

              <div className="futuro-cliente-form__actions">
                <button type="button" className="btn" onClick={() => { setEtapa('opcoes'); setErro(''); }} disabled={salvando}>
                  Voltar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar futuro cliente'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Aba: leads recebidos ─────────────────────────────────────────────────────

/**
 * Renderiza leads recebidos view com os dados informados.
 */
function LeadsRecebidosView({ agora }) {
  const navigate = useNavigate();
  const [envios, setEnvios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalAtualizacao, setModalAtualizacao] = useState(null);
  const [salvandoAtualizacao, setSalvandoAtualizacao] = useState(false);
  const [erroAtualizacao, setErroAtualizacao] = useState('');
  const [modalAdicionar, setModalAdicionar] = useState(null);
  const usuario = useMemo(() => getUsuarioLocal(), []);
  const podeRegistrarVenda = temPermissao(usuario, 'vendas_criar');
  const podeRegistrarFuturo = temPermissao(usuario, 'futuros_clientes_registrar');

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarMeusLeadEnvios()
      .then(data => { if (!cancelado) setEnvios(data); })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (selecionados.length === 0) {
      setLinhas([]);
      setTotalLinhas(0);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarMinhasLeadLinhas({ envio_ids: selecionados, page: pagina, page_size: 200, busca: buscaDeferred })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotalLinhas(data.total || 0);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, [selecionados, pagina, buscaDeferred]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const enviosSelecionados = useMemo(
    () => envios.filter(envio => selecionados.includes(envio.id)),
    [envios, selecionados]
  );

  const colunas = useMemo(() => {
    const mapa = new Map();

    enviosSelecionados.forEach(envio => {
      (envio.colunas_visiveis || []).forEach(coluna => {
        if (getLabelColunaLeadRecebido(coluna).endsWith(' (atualizado)')) return;
        const key = getColunaKeyLeadRecebido(coluna);
        mapa.set(key, coluna);
      });
    });

    if (mapa.size === 0) {
      linhas.forEach(linha => {
        Object.keys(linha.dados_json || {})
          .filter(coluna => !coluna.endsWith(' (atualizado)'))
          .forEach(coluna => mapa.set(coluna, coluna));
      });
    }

    return Array.from(mapa.values()).flatMap(coluna => (
      linhaTemColunaAtualizada(linhas, coluna)
        ? [coluna, criarColunaAtualizadaLeadRecebido(coluna)]
        : [coluna]
    ));
  }, [enviosSelecionados, linhas]);

  const totalPaginas = Math.max(1, Math.ceil(totalLinhas / 200));
  const totalColunasTabela = colunas.length + 2 + ((podeRegistrarVenda || podeRegistrarFuturo) ? 1 : 0);
  const totalFuturosClientesAtivos = linhas.filter(isFuturoClienteAtivo).length;
  const totalFuturosClientesVendidos = linhas.filter(isFuturoClienteVendido).length;

  /**
   * Alterna envio no estado atual.
   */
  function toggleEnvio(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    setPagina(1);
  }

  /**
   * Abre atualizacao e prepara o estado necessario.
   */
  function abrirAtualizacao(linha, coluna) {
    const nomeColuna = getNomeColunaLeadRecebido(linha, coluna);
    if (!nomeColuna) return;

    setErroAtualizacao('');
    setModalAtualizacao({
      linhaId: linha.id,
      coluna: nomeColuna,
      label: getLabelColunaLeadRecebido(coluna),
      valorOriginal: getValorLeadRecebido(linha, coluna),
      valorAtualizado: linha.dados_json?.[`${nomeColuna} (atualizado)`] || ''
    });
  }

  /**
   * Salva atualizacao com os dados informados.
   */
  async function salvarAtualizacao(valor) {
    if (!modalAtualizacao || !valor.trim()) {
      setErroAtualizacao('Informe a informação atualizada.');
      return;
    }

    setSalvandoAtualizacao(true);
    setErroAtualizacao('');
    setErro('');
    setSucesso('');

    try {
      const resultado = await atualizarCampoLeadRecebido(modalAtualizacao.linhaId, {
        coluna: modalAtualizacao.coluna,
        valor
      });

      setLinhas(prev => prev.map(linha => (
        linha.id === resultado.linha?.id ? resultado.linha : linha
      )));
      setModalAtualizacao(null);
      setSucesso('Informação atualizada salva.');
    } catch (error) {
      setErroAtualizacao(error.message || 'Erro ao atualizar lead recebido.');
    } finally {
      setSalvandoAtualizacao(false);
    }
  }

  /**
   * Executa a acao de continuar registro venda mantendo o estado da tela consistente.
   */
  function continuarRegistroVenda(vendaPreenchida) {
    navigate('/vendas?nova=1', {
      state: {
        vendaPreenchida,
        clientePreenchido: montarClientePreenchido(vendaPreenchida),
        origemLead: {
          linha_id: modalAdicionar?.id,
          envio: modalAdicionar?.envio?.nome || ''
        }
      }
    });
  }

  /**
   * Trata o evento de futuro cliente salvo.
   */
  function handleFuturoClienteSalvo(linhaAtualizada) {
    setLinhas(prev => prev.map(l => l.id === linhaAtualizada.id ? linhaAtualizada : l));
    setModalAdicionar(null);
    setSucesso('Lead marcado como futuro cliente com sucesso.');
  }

  return (
    <div className="clientes-leads-view">
      {modalAtualizacao && (
        <LeadAtualizacaoModal
          key={`${modalAtualizacao.linhaId}:${modalAtualizacao.coluna}`}
          dados={modalAtualizacao}
          salvando={salvandoAtualizacao}
          erro={erroAtualizacao}
          onClose={() => {
            if (salvandoAtualizacao) return;
            setModalAtualizacao(null);
            setErroAtualizacao('');
          }}
          onSave={salvarAtualizacao}
        />
      )}

      {modalAdicionar && (
        <AdicionarLeadModal
          linha={modalAdicionar}
          colunas={colunas}
          usuario={usuario}
          onClose={() => setModalAdicionar(null)}
          onRegistrarVenda={continuarRegistroVenda}
          onFuturoClienteSalvo={handleFuturoClienteSalvo}
        />
      )}

      <div className="clientes-leads-strip">
        <div className="clientes-leads-strip__title">Planilhas recebidas</div>
        <div className="clientes-leads-docs">
          {envios.map(envio => (
            <button
              key={envio.id}
              type="button"
              className={`clientes-leads-doc ${selecionados.includes(envio.id) ? 'active' : ''}`}
              onClick={() => toggleEnvio(envio.id)}
            >
              <div className="clientes-leads-preview">
                <span></span><span></span><span></span><span></span>
              </div>
              <strong title={envio.nome}>{envio.nome}</strong>
              <small>{formatDateValue(envio.created_at, undefined, '-')} - {envio.total_linhas} registros</small>
            </button>
          ))}
          {!carregando && envios.length === 0 && (
            <div className="lead-doc-empty">Nenhum envio recebido.</div>
          )}
        </div>
      </div>

      <div className="clientes-leads-toolbar">
        <div className="clientes-toolbar__meta">
          <span>{totalLinhas} registro(s) recebidos</span>
          <span className="clientes-toolbar__meta-secondary">
            {totalFuturosClientesAtivos} futuro(s) cliente(s)
          </span>
          {totalFuturosClientesVendidos > 0 && (
            <span className="clientes-toolbar__meta-sold">
              {totalFuturosClientesVendidos} com venda
            </span>
          )}
        </div>
        <div className="clientes-leads-actions">
          <form className="clientes-search" onSubmit={event => event.preventDefault()}>
            <I.Search size={14} />
            <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar no mailing recebido" />
          </form>
        </div>
      </div>

      {sucesso && <div className="alert-success alert-timed alert-timed--success">{sucesso}</div>}
      {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

      <div className="list-table clientes-leads-table" style={{ margin: 0 }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Envio</th>
                <th>Status</th>
                {(podeRegistrarVenda || podeRegistrarFuturo) && <th>Adicionar</th>}
                {colunas.map(coluna => <th key={getColunaKeyLeadRecebido(coluna)}>{getLabelColunaLeadRecebido(coluna)}</th>)}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={totalColunasTabela} className="muted" style={{ textAlign: 'center', padding: 40 }}>Carregando mailing...</td></tr>
              ) : linhas.length === 0 ? (
                <tr><td colSpan={totalColunasTabela} className="muted" style={{ textAlign: 'center', padding: 40 }}>Selecione uma planilha recebida.</td></tr>
              ) : (
                linhas.map(linha => (
                  <tr key={linha.id} className={isFuturoClienteVendido(linha) ? 'lead-row-vendido' : (isFuturoClienteAtivo(linha) ? 'lead-row-futuro' : '')}>
                    <td data-label="Envio" className="m-primary">
                      <span className="tag">{linha.envio?.nome || '-'}</span>
                      <details className="mobile-row-drawer">
                        <summary>Ver dados do lead</summary>
                        <dl>
                          {colunas.map(coluna => {
                            const valor = getValorLeadRecebido(linha, coluna);
                            return (
                              <Fragment key={getColunaKeyLeadRecebido(coluna)}>
                                <dt>{getLabelColunaLeadRecebido(coluna)}</dt>
                                <dd>{valor || '-'}</dd>
                              </Fragment>
                            );
                          })}
                        </dl>
                      </details>
                    </td>
                    <td data-label="Status" className="m-meta">{renderLeadStatus(linha, agora)}</td>
                    {(podeRegistrarVenda || podeRegistrarFuturo) && (
                      <td data-label="Adicionar" className="m-actions">
                        <button
                          type="button"
                          className={`lead-register-sale-btn ${isFuturoClienteNaLixeira(linha) ? 'is-disabled' : ''}`}
                          disabled={isFuturoClienteNaLixeira(linha)}
                          onClick={() => setModalAdicionar(linha)}
                        >
                          {isFuturoClienteNaLixeira(linha) ? 'Na lixeira' : isFuturoClienteAtivo(linha) ? 'Ver futuro cliente' : 'Adicionar'}
                        </button>
                      </td>
                    )}
                    {colunas.map(coluna => {
                      const valor = getValorLeadRecebido(linha, coluna);
                      const key = getColunaKeyLeadRecebido(coluna);
                      const podeAtualizar = !coluna.atualizada && Boolean(getNomeColunaLeadRecebido(linha, coluna));

                      return (
                        <td key={key} data-label={getLabelColunaLeadRecebido(coluna)} data-mobile-hidden="true" className={coluna.atualizada ? 'lead-updated-cell' : ''}>
                          {coluna.atualizada || !podeAtualizar ? (
                            valor || '-'
                          ) : (
                            <button
                              type="button"
                              className="lead-cell-button"
                              onClick={() => abrirAtualizacao(linha, coluna)}
                              title="Atualizar informação"
                            >
                              {valor || '-'}
                            </button>
                          )}
                        </td>
                      );
                    })}
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
  );
}

// ─── Modal: detalhe do futuro cliente ────────────────────────────────────────

/**
 * Renderiza futuro cliente detalhe modal.
 */
function FuturoClienteDetalheModal({ linha, onClose, onAtualizado, onRegistrarVenda }) {
  const vendaRegistrada = isFuturoClienteVendido(linha);
  const [etapa, setEtapa] = useState('ver'); // 'ver' | 'venda'
  const [notas, setNotas] = useState(linha.futuro_cliente_notas || '');
  const [retorno, setRetorno] = useState(formatarParaDatetimeLocal(linha.futuro_cliente_retorno));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [operadoras, setOperadoras] = useState([]);
  const [contatoNome, setContatoNome] = useState(linha.sondagem?.contato_nome || '');
  const [contatoTipo, setContatoTipo] = useState(linha.sondagem?.contato_tipo || '');
  const [operadoraAtualId, setOperadoraAtualId] = useState(String(linha.sondagem?.operadora_atual_id || ''));
  const [chipsItens, setChipsItens] = useState(() => criarChipsItensSondagem(linha.sondagem));
  const [whatsapp, setWhatsapp] = useState(() => formatarWhatsappInput(
    linha.sondagem
      ? `${linha.sondagem.whatsapp_ddd || ''}${linha.sondagem.whatsapp_numero || ''}`
      : encontrarTelefoneLead(linha)
  ));
  const valorMensalEstimado = chipsItens.reduce((total, item) => total
    + ((Number(item.quantidade) || 0) * (Number(String(item.preco_por_chip).replace(',', '.')) || 0)), 0);

  useEffect(() => {
    listarOperadoras().then(resultado => setOperadoras(Array.isArray(resultado) ? resultado : resultado?.data || [])).catch(() => setOperadoras([]));
  }, []);

  const usuario = useMemo(() => getUsuarioLocal(), []);

  const camposLead = useMemo(() => {
    const dados = linha.dados_json || {};
    return Object.entries(dados)
      .filter(([chave]) => !chave.endsWith(' (atualizado)'))
      .map(([chave, valor]) => ({
        label: chave,
        valor: dados[`${chave} (atualizado)`] ?? valor
      }));
  }, [linha]);

  /**
   * Salva  com os dados informados.
   */
  async function salvar(event) {
    event.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const retornoIso = datetimeRetornoParaIso(retorno);
      if (retorno && !retornoIso) {
        setErro('Informe uma data e hora de retorno validas.');
        setSalvando(false);
        return;
      }

      const resultado = await marcarFuturoClienteLead(linha.id, {
        notas,
        retorno: retornoIso,
        contato_nome: contatoNome,
        contato_tipo: contatoTipo,
        operadora_atual_id: Number(operadoraAtualId),
        chips_itens: chipsItens,
        whatsapp
      });
      onAtualizado(resultado.linha);
    } catch (error) {
      setErro(error.message || 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  if (etapa === 'venda') {
    return (
      <RegistrarVendaLeadModal
        linha={linha}
        colunas={[]}
        usuario={usuario}
        onClose={onClose}
        onConfirm={onRegistrarVenda}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={event => !salvando && event.target === event.currentTarget && onClose()}>
      <form className="modal adicionar-lead-modal" onSubmit={salvar}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Futuro cliente</div>
              <div className="modal-sub">{linha.envio?.nome || 'Lead'}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {camposLead.length > 0 && (
            <div className="adicionar-lead-dados">
              {camposLead.map(({ label, valor }) => (
                <div key={label} className="adicionar-lead-campo">
                  <span className="adicionar-lead-campo__label">{label}</span>
                  <span className="adicionar-lead-campo__valor">{formatarValorCampoLead(valor) || '-'}</span>
                </div>
              ))}
            </div>
          )}

          {linha.sondagem && (
            <div className="adicionar-lead-dados">
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">Pessoa contatada</span><span className="adicionar-lead-campo__valor">{linha.sondagem.contato_nome} ({String(linha.sondagem.contato_tipo || '').toUpperCase()})</span></div>
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">Operadora atual</span><span className="adicionar-lead-campo__valor">{linha.sondagem.operadoraAtual?.nome || '-'}</span></div>
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">Chips / preco</span><span className="adicionar-lead-campo__valor">{linha.sondagem.quantidade_chips} × {Number(linha.sondagem.preco_por_chip).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">Media mensal</span><span className="adicionar-lead-campo__valor">{Number(linha.sondagem.valor_mensal_estimado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">WhatsApp</span><span className="adicionar-lead-campo__valor">({linha.sondagem.whatsapp_ddd}) {linha.sondagem.whatsapp_numero}</span></div>
              <div className="adicionar-lead-campo"><span className="adicionar-lead-campo__label">Sondagem feita por</span><span className="adicionar-lead-campo__valor">{linha.sondagem.usuario?.nome || '-'}</span></div>
            </div>
          )}

          <div className="futuro-cliente-form">
            <div className="form-field">
              <label>Nome de quem falou</label>
              <input value={contatoNome} onChange={event => setContatoNome(event.target.value)} required disabled={salvando} />
            </div>
            <div className="form-field">
              <label>ADM ou RL</label>
              <select value={contatoTipo} onChange={event => setContatoTipo(event.target.value)} required disabled={salvando}>
                <option value="">Selecione</option>
                <option value="adm">ADM</option>
                <option value="rl">RL</option>
              </select>
            </div>
            <div className="form-field">
              <label>Operadora atual</label>
              <select value={operadoraAtualId} onChange={event => setOperadoraAtualId(event.target.value)} required disabled={salvando}>
                <option value="">Selecione</option>
                {operadoras.map(operadora => <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>)}
              </select>
            </div>
              <ChipsItensSondagem itens={chipsItens} onChange={setChipsItens} disabled={salvando} />
            <div className="futuro-cliente-estimativa">
              <span>Media mensal estimada</span>
              <strong>{valorMensalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </div>
            <div className="form-field">
              <label>WhatsApp com DDD</label>
              <input type="tel" inputMode="numeric" maxLength="15" autoComplete="tel" placeholder="(11) 99999-9999" value={whatsapp} onChange={event => setWhatsapp(formatarWhatsappInput(event.target.value))} required disabled={salvando} />
            </div>
            <div className="form-field">
              <label>Observações</label>
              <textarea
                rows={3}
                value={notas}
                onChange={event => setNotas(event.target.value)}
                placeholder="Observações, interesses, histórico..."
                disabled={salvando}
              />
            </div>
            <div className="form-field">
              <label>Data de retorno</label>
              <input
                type="datetime-local"
                value={retorno}
                onChange={event => setRetorno(event.target.value)}
                disabled={salvando}
              />
            </div>
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 8 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          {vendaRegistrada ? (
            <div className="lead-already-qualified-notice">Este futuro cliente ja possui uma venda registrada. Acesse a pagina de Vendas para visualizar a venda.</div>
          ) : (
            <button type="button" className="btn" onClick={() => setEtapa('venda')} disabled={salvando}>
              <I.Chart size={14} /> Registrar venda
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Aba: futuros clientes ────────────────────────────────────────────────────

/**
 * Renderiza confirmar futuro cliente lixeira modal.
 */
function ConfirmarFuturoClienteLixeiraModal({ linha, tipo, processando, onClose, onConfirm }) {
  if (!linha || !tipo) return null;

  const definitivo = tipo === 'definitivo';
  const titulo = definitivo ? 'Excluir definitivamente?' : 'Enviar futuro cliente para lixeira?';
  const texto = definitivo
    ? 'Este futuro cliente sera removido da lista permanentemente. A linha original do lead sera preservada.'
    : 'Este futuro cliente ficara na lixeira por 30 dias antes da exclusao definitiva.';

  return (
    <div className="modal-overlay" onClick={event => !processando && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{titulo}</div>
              <div className="modal-sub">{linha.envio?.nome || 'Lead'} - #{linha.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={processando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="trash-warning">
            <I.AlertTriangle size={20} />
            <div>
              <strong>{definitivo ? 'Esta acao nao pode ser desfeita.' : 'O item podera ser restaurado pela lixeira.'}</strong>
              <span>{texto}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={processando}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={processando}>
            {processando ? 'Processando...' : definitivo ? 'Excluir definitivamente' : 'Enviar para lixeira'}
          </button>
        </div>
      </div>
    </div>
  );
}


function dataLocalIso(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDataIso(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) return '-';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Permite escolher o período e baixar a produtividade de todos os consultores. */
function ExportarProdutividadeModal({ onClose }) {
  const hoje = useMemo(() => dataLocalIso(), []);
  const [dataInicio, setDataInicio] = useState(`${hoje.slice(0, 7)}-01`);
  const [dataFim, setDataFim] = useState(hoje);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState('');
  const periodoInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);

  function selecionarPeriodo(inicio, fim) {
    setDataInicio(inicio);
    setDataFim(fim);
    setErro('');
  }

  async function baixar() {
    if (periodoInvalido) return;
    setBaixando(true);
    setErro('');
    try {
      await exportarMetricasFuturosClientesExcel({
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      onClose();
    } catch (error) {
      setErro(error.message || 'Erro ao baixar a planilha.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={event => !baixando && event.target === event.currentTarget && onClose()}>
      <div className="modal exportar-produtividade-modal" role="dialog" aria-modal="true" aria-labelledby="exportar-produtividade-titulo">
        <div className="modal-header">
          <div className="modal-header-row">
            <div className="consultor-modal-title">
              <span className="consultor-modal-eyebrow"><I.Download size={13} /> Relatório Excel</span>
              <div className="modal-client" id="exportar-produtividade-titulo">Exportar produtividade</div>
              <div className="modal-sub">Baixe os resultados de todos os consultores de primeira ligação.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={baixando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body exportar-produtividade-body">
          <div className="exportar-produtividade-info">
            <I.Calendar size={20} />
            <div>
              <strong>Escolha o período do relatório</strong>
              <span>O arquivo inclui um resumo por consultor e o detalhamento de cada dia.</span>
            </div>
          </div>

          <div className="consultor-periodo-filtros exportar-produtividade-filtros">
            <label className="form-field">
              <span>Data inicial</span>
              <input type="date" value={dataInicio} max={dataFim || undefined} onChange={event => selecionarPeriodo(event.target.value, dataFim)} />
            </label>
            <label className="form-field">
              <span>Data final</span>
              <input type="date" value={dataFim} min={dataInicio || undefined} onChange={event => selecionarPeriodo(dataInicio, event.target.value)} />
            </label>
          </div>

          <div className="consultor-periodo-atalhos exportar-produtividade-atalhos">
            <button type="button" className="btn" onClick={() => selecionarPeriodo(hoje, hoje)}>Hoje</button>
            <button type="button" className="btn" onClick={() => selecionarPeriodo(`${hoje.slice(0, 7)}-01`, hoje)}>Este mês</button>
            <button type="button" className="btn" onClick={() => selecionarPeriodo('', '')}>Todo o período</button>
          </div>

          {(periodoInvalido || erro) && (
            <div className="alert-error">
              {periodoInvalido ? 'A data inicial deve ser anterior ou igual a data final.' : erro}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={baixando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={baixar} disabled={baixando || periodoInvalido}>
            <I.Download size={15} /> {baixando ? 'Gerando planilha...' : 'Baixar Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Exibe a produtividade de primeira ligacao de um consultor por periodo. */
function ConsultorPrimeiraLigacaoModal({ consultor, onClose }) {
  const hoje = useMemo(() => dataLocalIso(), []);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [dias, setDias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const periodoInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);

  useEffect(() => {
    if (periodoInvalido) {
      return undefined;
    }

    let cancelado = false;
    listarMetricasFuturosClientes({
      usuario_id: consultor.usuario_id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      agrupar_por: 'dia'
    })
      .then(data => !cancelado && setDias(Array.isArray(data) ? data : []))
      .catch(error => !cancelado && setErro(error.message || 'Erro ao carregar a produtividade.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, [consultor.usuario_id, dataInicio, dataFim, periodoInvalido]);

  const resumo = useMemo(() => (periodoInvalido ? [] : dias).reduce((acc, item) => ({
    ligacoes: acc.ligacoes + Number(item.qualificados || 0),
    distribuidos: acc.distribuidos + Number(item.distribuidos_venda || 0),
    vendidos: acc.vendidos + Number(item.vendidos || 0),
    potencial: acc.potencial + Number(item.potencial_mensal || 0)
  }), { ligacoes: 0, distribuidos: 0, vendidos: 0, potencial: 0 }), [dias, periodoInvalido]);
  const diasExibidos = periodoInvalido ? [] : dias;

  function selecionarPeriodo(inicio, fim) {
    if (inicio === dataInicio && fim === dataFim) return;
    setCarregando(!(inicio && fim && inicio > fim));
    setErro('');
    setDataInicio(inicio);
    setDataFim(fim);
  }

  function selecionarHoje() {
    selecionarPeriodo(hoje, hoje);
  }

  function selecionarMes() {
    selecionarPeriodo(`${hoje.slice(0, 7)}-01`, hoje);
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal consultor-produtividade-modal" role="dialog" aria-modal="true" aria-labelledby="consultor-produtividade-titulo">
        <div className="modal-header">
          <div className="modal-header-row">
            <div className="consultor-modal-title">
              <span className="consultor-modal-eyebrow">Consultor de primeira ligação</span>
              <div className="modal-client" id="consultor-produtividade-titulo">{consultor.usuario_nome || 'Usuário removido'}</div>
              <div className="modal-sub">Acompanhe a qualificação e a conversão no período selecionado.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body consultor-produtividade-body">
          <div className="consultor-periodo-label"><I.Calendar size={15} /><span>Período analisado</span></div>
          <div className="consultor-periodo-filtros">
            <label className="form-field">
              <span>Data inicial</span>
              <input type="date" value={dataInicio} max={dataFim || undefined} onChange={event => selecionarPeriodo(event.target.value, dataFim)} />
            </label>
            <label className="form-field">
              <span>Data final</span>
              <input type="date" value={dataFim} min={dataInicio || undefined} onChange={event => selecionarPeriodo(dataInicio, event.target.value)} />
            </label>
            <div className="consultor-periodo-atalhos">
              <button type="button" className="btn" onClick={selecionarHoje}>Hoje</button>
              <button type="button" className="btn" onClick={selecionarMes}>Este mês</button>
              <button type="button" className="btn" onClick={() => selecionarPeriodo('', '')}>Todo o período</button>
            </div>
          </div>

          {(periodoInvalido || erro) && <div className="alert-error">{periodoInvalido ? 'A data inicial deve ser anterior ou igual a data final.' : erro}</div>}

          <div className="consultor-produtividade-metricas">
            <div className="is-primary"><span>Ligações feitas</span><strong>{carregando ? '...' : resumo.ligacoes}</strong></div>
            <div><span>Enviados para venda</span><strong>{carregando ? '...' : resumo.distribuidos}</strong></div>
            <div><span>Vendas originadas</span><strong>{carregando ? '...' : resumo.vendidos}</strong></div>
            <div><span>Conversão</span><strong>{carregando ? '...' : resumo.ligacoes ? `${((resumo.vendidos / resumo.ligacoes) * 100).toFixed(1)}%` : '0%'}</strong></div>
            <div><span>Potencial mensal</span><strong>{carregando ? '...' : resumo.potencial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
          </div>

          <p className="consultor-produtividade-nota">Uma ligação é contabilizada quando o futuro cliente é qualificado.</p>

          <div className="list-table consultor-produtividade-table">
            <div className="scroll">
              <table>
                <thead><tr><th>Data</th><th>Ligações</th><th>Enviados para venda</th><th>Vendas</th><th>Potencial mensal</th></tr></thead>
                <tbody>
                  {carregando ? (
                    <tr><td colSpan="5" className="muted">Carregando produtividade...</td></tr>
                  ) : diasExibidos.length === 0 ? (
                    <tr><td colSpan="5" className="muted">Nenhuma ligação registrada neste período.</td></tr>
                  ) : diasExibidos.map(item => (
                    <tr key={item.data}>
                      <td>{formatarDataIso(String(item.data).slice(0, 10))}</td>
                      <td>{Number(item.qualificados || 0)}</td>
                      <td>{Number(item.distribuidos_venda || 0)}</td>
                      <td>{Number(item.vendidos || 0)}</td>
                      <td>{Number(item.potencial_mensal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renderiza futuros clientes main view com os dados informados.
 */
function FuturosClientesMainView({ agora }) {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [linhaAtiva, setLinhaAtiva] = useState(null);
  const [modoLixeira, setModoLixeira] = useState(false);
  const [processandoId, setProcessandoId] = useState(null);
  const [confirmacaoLixeira, setConfirmacaoLixeira] = useState(null);
  const [metricas, setMetricas] = useState([]);
  const [consultorAtivo, setConsultorAtivo] = useState(null);
  const [exportacaoAberta, setExportacaoAberta] = useState(false);

  const usuario = useMemo(() => getUsuarioLocal(), []);
  const podeGerenciar = temPermissao(usuario, 'futuros_clientes_registrar');
  const podeVerQuadroGeral = temPermissao(usuario, 'gerenciar_leads');

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    const listar = modoLixeira
      ? listarFuturosClientesLixeira
      : (podeVerQuadroGeral ? listarQuadroFuturosClientes : listarFuturosClientesLeads);
    listar({ page: pagina, page_size: 50, busca: buscaDeferred })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotal(data.total || 0);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar futuros clientes.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => { cancelado = true; };
  }, [pagina, buscaDeferred, modoLixeira]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!podeVerQuadroGeral || modoLixeira) return;
    listarMetricasFuturosClientes()
      .then(data => setMetricas(Array.isArray(data) ? data : []))
      .catch(() => setMetricas([]));
  }, [podeVerQuadroGeral, modoLixeira, linhas]);

  const resumoMetricas = useMemo(() => metricas.reduce((acc, item) => ({
    qualificados: acc.qualificados + Number(item.qualificados || 0),
    distribuidos: acc.distribuidos + Number(item.distribuidos_venda || 0),
    vendidos: acc.vendidos + Number(item.vendidos || 0),
    potencial: acc.potencial + Number(item.potencial_mensal || 0)
  }), { qualificados: 0, distribuidos: 0, vendidos: 0, potencial: 0 }), [metricas]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const colunasDados = useMemo(() => {
    const mapa = new Map();
    linhas.forEach(linha => {
      Object.keys(linha.dados_json || {})
        .filter(chave => !chave.endsWith(' (atualizado)'))
        .forEach(chave => mapa.set(chave, chave));
    });
    return Array.from(mapa.keys());
  }, [linhas]);

  const totalPaginas = Math.max(1, Math.ceil(total / 50));
  const totalColunasTabela = colunasDados.length + 4 + (modoLixeira ? 2 : 0) + (podeGerenciar ? 1 : 0);

  /**
   * Trata o evento de atualizado.
   */
  function handleAtualizado(linhaAtualizada) {
    setLinhas(prev => prev.map(l => l.id === linhaAtualizada.id ? linhaAtualizada : l));
    setLinhaAtiva(null);
  }

  /**
   * Alterna modo lixeira no estado atual.
   */
  function alternarModoLixeira(proximoModo) {
    setModoLixeira(proximoModo);
    setPagina(1);
    setLinhaAtiva(null);
    setErro('');
    setSucesso('');
  }

  /**
   * Executa a acao de confirmar mover para lixeira mantendo o estado da tela consistente.
   */
  async function confirmarMoverParaLixeira() {
    const linha = confirmacaoLixeira?.linha;
    if (!linha) return;

    setProcessandoId(linha.id);
    setErro('');
    setSucesso('');

    try {
      await excluirFuturoCliente(linha.id);
      setLinhas(prev => prev.filter(item => item.id !== linha.id));
      setTotal(prev => Math.max(0, prev - 1));
      setConfirmacaoLixeira(null);
      setSucesso('Futuro cliente enviado para a lixeira.');
    } catch (error) {
      setErro(error.message || 'Erro ao enviar futuro cliente para a lixeira.');
    } finally {
      setProcessandoId(null);
    }
  }

  /**
   * Trata o evento de restaurar.
   */
  async function handleRestaurar(linha) {
    setProcessandoId(linha.id);
    setErro('');
    setSucesso('');

    try {
      await restaurarFuturoCliente(linha.id);
      setLinhas(prev => prev.filter(item => item.id !== linha.id));
      setTotal(prev => Math.max(0, prev - 1));
      setSucesso('Futuro cliente restaurado.');
    } catch (error) {
      setErro(error.message || 'Erro ao restaurar futuro cliente.');
    } finally {
      setProcessandoId(null);
    }
  }

  /**
   * Executa a acao de confirmar exclusao definitiva mantendo o estado da tela consistente.
   */
  async function confirmarExclusaoDefinitiva() {
    const linha = confirmacaoLixeira?.linha;
    if (!linha) return;

    setProcessandoId(linha.id);
    setErro('');
    setSucesso('');

    try {
      await excluirFuturoClienteDefinitivo(linha.id);
      setLinhas(prev => prev.filter(item => item.id !== linha.id));
      setTotal(prev => Math.max(0, prev - 1));
      setConfirmacaoLixeira(null);
      setSucesso('Futuro cliente excluído definitivamente.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir futuro cliente definitivamente.');
    } finally {
      setProcessandoId(null);
    }
  }

  /**
   * Trata o evento de registrar venda.
   */
  function handleRegistrarVenda(vendaPreenchida) {
    navigate('/vendas?nova=1', {
      state: {
        vendaPreenchida,
        clientePreenchido: montarClientePreenchido(vendaPreenchida),
        origemLead: {
          linha_id: linhaAtiva?.id,
          envio: linhaAtiva?.envio?.nome || ''
        }
      }
    });
  }

  return (
    <div className="futuros-clientes-view">
      <ConfirmarFuturoClienteLixeiraModal
        linha={confirmacaoLixeira?.linha}
        tipo={confirmacaoLixeira?.tipo}
        processando={processandoId === confirmacaoLixeira?.linha?.id}
        onClose={() => setConfirmacaoLixeira(null)}
        onConfirm={confirmacaoLixeira?.tipo === 'definitivo' ? confirmarExclusaoDefinitiva : confirmarMoverParaLixeira}
      />

      {linhaAtiva && (
        <FuturoClienteDetalheModal
          linha={linhaAtiva}
          onClose={() => setLinhaAtiva(null)}
          onAtualizado={handleAtualizado}
          onRegistrarVenda={handleRegistrarVenda}
        />
      )}

      {consultorAtivo && (
        <ConsultorPrimeiraLigacaoModal consultor={consultorAtivo} onClose={() => setConsultorAtivo(null)} />
      )}

      {exportacaoAberta && <ExportarProdutividadeModal onClose={() => setExportacaoAberta(false)} />}

      {podeVerQuadroGeral && !modoLixeira && (
        <section className="conversao-sondagem-module">
          <div className="conversao-sondagem-header">
            <div>
              <h2>Conversão da primeira ligação</h2>
              <p>A venda é atribuída ao consultor que qualificou o futuro cliente, mesmo quando outro consultor fecha.</p>
            </div>
            <button type="button" className="btn conversao-exportar-btn" onClick={() => setExportacaoAberta(true)}>
              <I.Download size={15} /> Baixar Excel
            </button>
          </div>
          <div className="futuros-clientes-metricas">
            <div><span>Qualificados</span><strong>{resumoMetricas.qualificados}</strong></div>
            <div><span>Distribuidos para venda</span><strong>{resumoMetricas.distribuidos}</strong></div>
            <div><span>Vendas originadas</span><strong>{resumoMetricas.vendidos}</strong></div>
            <div><span>Conversao dos qualificados</span><strong>{resumoMetricas.qualificados ? `${((resumoMetricas.vendidos / resumoMetricas.qualificados) * 100).toFixed(1)}%` : '0%'}</strong></div>
            <div><span>Potencial mensal</span><strong>{resumoMetricas.potencial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
          </div>
          <div className="list-table conversao-sondagem-table">
            <div className="scroll">
              <table>
                <thead><tr><th>Consultor da primeira ligacao</th><th>Qualificados</th><th>Enviados para venda</th><th>Vendas originadas</th><th>Conversao</th><th>Potencial mensal</th></tr></thead>
                <tbody>
                  {metricas.length === 0 ? (
                    <tr><td colSpan="6" className="muted">Ainda nao existem qualificacoes para calcular a conversao.</td></tr>
                  ) : metricas.map(item => {
                    const qualificados = Number(item.qualificados || 0);
                    const vendidos = Number(item.vendidos || 0);
                    return (
                      <tr
                        key={item.usuario_id || item.usuario_nome}
                        className="consultor-metricas-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => setConsultorAtivo(item)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setConsultorAtivo(item);
                          }
                        }}
                      >
                        <td><strong>{item.usuario_nome || 'Usuario removido'}</strong></td>
                        <td>{qualificados}</td>
                        <td>{Number(item.distribuidos_venda || 0)}</td>
                        <td>{vendidos}</td>
                        <td><span className="pill success">{qualificados ? `${((vendidos / qualificados) * 100).toFixed(1)}%` : '0%'}</span></td>
                        <td>{Number(item.potencial_mensal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      <div className="clientes-leads-toolbar">
        <form className="clientes-search" onSubmit={event => event.preventDefault()}>
          <I.Search size={14} />
          <input
            value={busca}
            onChange={event => { setBusca(event.target.value); setPagina(1); }}
            placeholder={modoLixeira ? 'Buscar na lixeira...' : 'Buscar futuros clientes...'}
          />
        </form>
        <div className="clientes-leads-actions">
          <div className="clientes-toolbar__meta">
            {total} {modoLixeira ? 'na lixeira' : 'futuro(s) cliente(s)'}
          </div>
          {modoLixeira ? (
            <button type="button" className="btn" onClick={() => alternarModoLixeira(false)}>
              <I.Return size={14} /> Futuros clientes
            </button>
          ) : podeGerenciar ? (
            <button type="button" className="btn btn-danger" onClick={() => alternarModoLixeira(true)}>
              <I.Trash size={14} /> Lixeira
            </button>
          ) : null}
        </div>
      </div>

      {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 4 }}>{sucesso}</div>}
      {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

      <div className="list-table futuros-clientes-table" style={{ margin: 0 }}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Envio</th>
                <th>Notas</th>
                <th>Retorno</th>
                <th>{modoLixeira ? 'Enviado para lixeira' : 'Marcado em'}</th>
                {modoLixeira && (
                  <>
                    <th>Exclusao definitiva</th>
                    <th>Enviado por</th>
                  </>
                )}
                {colunasDados.map(chave => <th key={chave}>{chave}</th>)}
                {podeGerenciar && <th>{modoLixeira ? 'Acoes' : 'Excluir'}</th>}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={totalColunasTabela} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    {modoLixeira ? 'Carregando lixeira...' : 'Carregando futuros clientes...'}
                  </td>
                </tr>
              ) : linhas.length === 0 ? (
                <tr>
                  <td colSpan={totalColunasTabela} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    {modoLixeira ? 'Nenhum futuro cliente na lixeira.' : 'Nenhum futuro cliente cadastrado.'}
                  </td>
                </tr>
              ) : (
                linhas.map(linha => {
                  const dados = linha.dados_json || {};
                  return (
                    <tr
                      key={linha.id}
                      style={{ cursor: modoLixeira ? 'default' : 'pointer' }}
                      onClick={() => !modoLixeira && setLinhaAtiva(linha)}
                    >
                      <td data-label="Envio" className="m-primary">
                        <span className="tag">{linha.envio?.nome || '-'}</span>
                        <details className="mobile-row-drawer">
                          <summary>Ver dados do futuro cliente</summary>
                          <dl>
                            <dt>Notas</dt>
                            <dd>{linha.futuro_cliente_notas || '-'}</dd>
                            <dt>Retorno</dt>
                            <dd className={isRetornoFuturoClienteVencido(linha.futuro_cliente_retorno, agora) ? 'future-return-overdue' : ''}>
                              {linha.futuro_cliente_retorno ? formatarDataHora(linha.futuro_cliente_retorno) : '-'}
                            </dd>
                            <dt>{modoLixeira ? 'Enviado para lixeira' : 'Marcado em'}</dt>
                            <dd>{formatarDataHora(modoLixeira ? linha.futuro_cliente_excluido_em : linha.futuro_cliente_marcado_em)}</dd>
                            {modoLixeira && (
                              <>
                                <dt>Exclusao definitiva</dt>
                                <dd>{formatarData(linha.futuro_cliente_excluir_definitivo_em)}</dd>
                                <dt>Enviado por</dt>
                                <dd>{linha.futuroClienteExcluidoPor?.nome || '-'}</dd>
                              </>
                            )}
                            {colunasDados.map(chave => {
                              const valor = dados[`${chave} (atualizado)`] ?? dados[chave] ?? '';
                              return (
                                <Fragment key={chave}>
                                  <dt>{chave}</dt>
                                  <dd>{valor || '-'}</dd>
                                </Fragment>
                              );
                            })}
                          </dl>
                        </details>
                      </td>
                      <td data-label="Notas" className="m-secondary">
                        <span
                          className={`futuro-cliente-notas-cell ${linha.futuro_cliente_notas ? '' : 'muted'}`}
                          title={linha.futuro_cliente_notas || ''}
                        >
                          {linha.futuro_cliente_notas || '-'}
                        </span>
                      </td>
                      <td data-label="Retorno" className="m-meta">
                        {linha.futuro_cliente_retorno ? (
                          <span className={`pill ${isRetornoFuturoClienteVencido(linha.futuro_cliente_retorno, agora) ? 'danger future-return-overdue' : 'success'}`}>
                            <span className="pill-dot"></span>
                            {formatarDataHora(linha.futuro_cliente_retorno)}
                          </span>
                        ) : '-'}
                      </td>
                      <td data-label={modoLixeira ? 'Enviado para lixeira' : 'Marcado em'} data-mobile-hidden="true">{formatarDataHora(modoLixeira ? linha.futuro_cliente_excluido_em : linha.futuro_cliente_marcado_em)}</td>
                      {modoLixeira && (
                        <>
                          <td data-label="Exclusao definitiva" data-mobile-hidden="true">{formatarData(linha.futuro_cliente_excluir_definitivo_em)}</td>
                          <td data-label="Enviado por" data-mobile-hidden="true"><span className="tag">{linha.futuroClienteExcluidoPor?.nome || '-'}</span></td>
                        </>
                      )}
                      {colunasDados.map(chave => {
                        const valor = dados[`${chave} (atualizado)`] ?? dados[chave] ?? '';
                        return <td key={chave} data-label={chave} data-mobile-hidden="true">{valor || '-'}</td>;
                      })}
                      {podeGerenciar && (
                        <td data-label={modoLixeira ? 'Acoes' : 'Excluir'} className="futuros-clientes-delete-col m-actions">
                          <div className="futuros-clientes-actions">
                            {modoLixeira ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={processandoId === linha.id}
                                  onClick={event => {
                                    event.stopPropagation();
                                    handleRestaurar(linha);
                                  }}
                                >
                                  <I.Return size={13} /> Restaurar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-ghost btn-danger-icon"
                                  title="Excluir definitivamente"
                                  disabled={processandoId === linha.id}
                                  onClick={event => {
                                    event.stopPropagation();
                                    setConfirmacaoLixeira({ linha, tipo: 'definitivo' });
                                  }}
                                >
                                  <I.Trash size={13} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-icon btn-ghost btn-danger-icon"
                                title="Enviar para lixeira"
                                aria-label="Enviar para lixeira"
                                disabled={processandoId === linha.id}
                                onClick={event => {
                                  event.stopPropagation();
                                  setConfirmacaoLixeira({ linha, tipo: 'lixeira' });
                                }}
                              >
                                <I.Trash size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
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
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

/**
 * Renderiza futuros clientes page.
 */
function FuturosClientesPage() {
  const [abaAtiva, setAbaAtiva] = useState('futuros');
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <LayoutPrivado>
      <div className="futuros-clientes-page">
        <div className="clientes-tabs">
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'futuros' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('futuros')}
          >
            Futuros clientes
          </button>
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'leads' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('leads')}
          >
            Mailing recebido
          </button>
        </div>

        {abaAtiva === 'leads' ? (
          <LeadsRecebidosView agora={agora} />
        ) : (
          <FuturosClientesMainView agora={agora} />
        )}
      </div>
    </LayoutPrivado>
  );
}

export default FuturosClientesPage;
