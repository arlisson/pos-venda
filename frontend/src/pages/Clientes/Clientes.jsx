import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { atualizarCliente, criarCliente, excluirCliente, listarClientes } from '../../services/cliente.service';
import { consultarCnpj, isCnpjRepetido, sanitizarCnpj } from '../../services/cnpj.service';
import { listarOperadoras } from '../../services/config.service';
import {
  atualizarCampoLeadRecebido,
  listarMeusLeadEnvios,
  listarMinhasLeadLinhas
} from '../../services/lead-planilha.service';
import './Clientes.css';

const FORM_INICIAL = {
  nome: '',
  razao_social: '',
  cnpj: '',
  responsavel_tipo: 'rl',
  responsavel_nome: '',
  email: '',
  whatsapp: '',
  fixo: '',
  fidelidade_fim: '',
  operadora_atual_id: '',
  quantidade_chips: ''
};

const CAMPOS_VENDA_LEAD = [
  { name: 'nome', label: 'Nome do cliente', required: true, aliases: ['nome', 'cliente', 'razao', 'empresa'] },
  { name: 'telefone', label: 'Telefone/WhatsApp', aliases: ['telefone', 'whatsapp', 'celular', 'contato'] },
  { name: 'email', label: 'E-mail', aliases: ['email', 'e-mail'] },
  { name: 'razao_social', label: 'Razao social', aliases: ['razao social', 'empresa'] },
  { name: 'cnpj', label: 'CNPJ', aliases: ['cnpj'] },
  { name: 'nome_representante_legal', label: 'Representante legal', aliases: ['representante', 'responsavel', 'rl'] },
  { name: 'cpf_representante_legal', label: 'CPF representante', aliases: ['cpf representante', 'cpf rl', 'cpf'] },
  { name: 'nome_administrador', label: 'Administrador', aliases: ['administrador', 'adm'] },
  { name: 'cpf_administrador', label: 'CPF administrador', aliases: ['cpf administrador', 'cpf adm'] },
  { name: 'nome_fechou_venda', label: 'Nome com quem fechou', aliases: ['fechou', 'contato', 'responsavel'] },
  { name: 'setor_funcao', label: 'Setor/Funcao', aliases: ['setor', 'funcao', 'cargo'] },
  { name: 'quantidade_linhas', label: 'Quantidade de linhas', aliases: ['quantidade', 'linhas', 'chips'] },
  { name: 'ddd', label: 'DDD', aliases: ['ddd'] },
  { name: 'data_venda', label: 'Data da venda', aliases: ['data', 'data venda'] },
  { name: 'dia_vencimento', label: 'Dia de vencimento', aliases: ['vencimento'] },
  { name: 'cep', label: 'CEP', aliases: ['cep'] },
  { name: 'endereco', label: 'Endereco', aliases: ['endereco', 'logradouro', 'rua'] },
  { name: 'numero_endereco', label: 'Numero endereco', aliases: ['numero', 'num'] },
  { name: 'complemento', label: 'Complemento', aliases: ['complemento'] },
  { name: 'bairro', label: 'Bairro', aliases: ['bairro'] },
  { name: 'municipio', label: 'Municipio', aliases: ['municipio', 'cidade'] },
  { name: 'uf', label: 'UF', aliases: ['uf', 'estado'] },
  { name: 'ponto_referencia', label: 'Ponto de referencia', aliases: ['referencia'] },
  { name: 'observacoes', label: 'Observacoes', aliases: ['observacao', 'observacoes', 'obs'] }
];

function normalizarDataInput(valor) {
  if (!valor) return '';

  const texto = String(valor).slice(0, 10);
  return texto === '1899-11-30' ? '' : texto;
}

function apenasDigitos(valor, limite) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return limite ? digitos.slice(0, limite) : digitos;
}

function formatarCnpj(valor) {
  const digitos = apenasDigitos(valor, 14);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function formatarTelefoneComDdd(valor, celular = false) {
  const digitos = apenasDigitos(valor, celular ? 11 : 10);

  if (digitos.length <= 2) {
    return digitos ? `(${digitos}` : '';
  }

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);

  if (celular) {
    if (numero.length <= 5) return `(${ddd}) ${numero}`;
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }

  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

function juntarTelefone(ddd, numero, celular = false) {
  return formatarTelefoneComDdd(`${ddd || ''}${numero || ''}`, celular);
}

function separarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) {
    return { ddd: null, numero: null };
  }

  return {
    ddd: digitos.slice(0, 2) || null,
    numero: digitos.slice(2) || null
  };
}

function montarPayloadCliente(form) {
  const whatsapp = separarTelefone(form.whatsapp);
  const fixo = separarTelefone(form.fixo);

  return {
    ...form,
    cnpj: formatarCnpj(form.cnpj),
    whatsapp_ddd: whatsapp.ddd,
    whatsapp_numero: whatsapp.numero,
    fixo_ddd: fixo.ddd,
    fixo_numero: fixo.numero,
    fidelidade_fim: form.fidelidade_fim || null,
    operadora_atual_id: form.operadora_atual_id ? Number(form.operadora_atual_id) : null,
    quantidade_chips: form.quantidade_chips !== '' ? Number(form.quantidade_chips) : null
  };
}

function normalizarClienteForm(cliente) {
  if (!cliente) return FORM_INICIAL;

  return {
    nome: cliente.nome || '',
    razao_social: cliente.razao_social || '',
    cnpj: formatarCnpj(cliente.cnpj),
    responsavel_tipo: cliente.responsavel_tipo || 'rl',
    responsavel_nome: cliente.responsavel_nome || '',
    email: cliente.email || '',
    whatsapp: juntarTelefone(cliente.whatsapp_ddd, cliente.whatsapp_numero, true),
    fixo: juntarTelefone(cliente.fixo_ddd, cliente.fixo_numero),
    fidelidade_fim: normalizarDataInput(cliente.fidelidade_fim),
    operadora_atual_id: cliente.operadora_atual_id || '',
    quantidade_chips: cliente.quantidade_chips ?? ''
  };
}

function formatarContato(cliente) {
  const whatsapp = [cliente.whatsapp_ddd, cliente.whatsapp_numero].filter(Boolean).join(' ');
  const fixo = [cliente.fixo_ddd, cliente.fixo_numero].filter(Boolean).join(' ');

  return { whatsapp, fixo };
}

function formatarFidelidade(aviso) {
  if (!aviso || aviso.dias_restantes === null || aviso.dias_restantes === undefined) {
    return { label: 'Sem fidelidade', className: '' };
  }

  if (aviso.dias_restantes < 0) {
    return { label: 'Vencida', className: 'danger' };
  }

  if (aviso.deve_avisar) {
    return {
      label: aviso.dias_restantes === 0 ? 'Vence hoje' : `${aviso.dias_restantes} dias`,
      className: 'warn'
    };
  }

  return { label: `${aviso.dias_restantes} dias`, className: 'success' };
}

function normalizarTextoLead(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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

function getNomeColunaLeadRecebido(linha, coluna) {
  if (!coluna) return '';
  if (typeof coluna === 'string') return coluna;
  if (coluna.planilhaId && Number(linha.planilha_id) !== Number(coluna.planilhaId)) return '';

  const source = coluna.sources?.find(item => Number(item.planilhaId) === Number(linha.planilha_id));
  return source?.nome || coluna.nome || coluna.label || '';
}

function getLabelColunaLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.label || coluna?.nome || '';
}

function getColunaKeyLeadRecebido(coluna) {
  if (typeof coluna === 'string') return coluna;
  return coluna?.id || coluna?.nome || coluna?.label || '';
}

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

function linhaTemColunaAtualizada(linhas, coluna) {
  return linhas.some(linha => {
    const nome = getNomeColunaLeadRecebido(linha, coluna);
    return nome && Object.prototype.hasOwnProperty.call(linha.dados_json || {}, `${nome} (atualizado)`);
  });
}

function getValorLeadPorNome(linha, nomeColuna) {
  if (!nomeColuna) return '';
  const dados = linha.dados_json || {};
  const nomeAtualizado = `${nomeColuna} (atualizado)`;
  return dados[nomeAtualizado] ?? dados[nomeColuna] ?? '';
}

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

function sugerirColunaVenda(campo, opcoes) {
  const aliases = [campo.label, campo.name, ...(campo.aliases || [])].map(normalizarTextoLead);
  const encontrada = opcoes.find(opcao => {
    const label = normalizarTextoLead(opcao.label);
    const nome = normalizarTextoLead(opcao.nome);
    return aliases.some(alias => alias && (label.includes(alias) || nome.includes(alias) || alias.includes(label)));
  });

  return encontrada?.nome || '';
}

function montarVendaPreenchidaDoLead(linha, mapeamento, usuario) {
  const payload = usuario?.id ? { vendedora_id: String(usuario.id) } : {};

  CAMPOS_VENDA_LEAD.forEach(campo => {
    const coluna = mapeamento?.[campo.name];
    const valor = getValorLeadPorNome(linha, coluna);
    if (String(valor || '').trim()) {
      payload[campo.name] = valor;
    }
  });

  return payload;
}

function RegistrarVendaLeadModal({ linha, colunas, usuario, onClose, onConfirm }) {
  const opcoesColunas = useMemo(() => getColunasMapeaveisLead(linha, colunas), [linha, colunas]);
  const [mapeamento, setMapeamento] = useState(() => (
    CAMPOS_VENDA_LEAD.reduce((acc, campo) => ({
      ...acc,
      [campo.name]: sugerirColunaVenda(campo, opcoesColunas)
    }), {})
  ));

  function atualizarMapeamento(campo, valor) {
    setMapeamento(prev => ({ ...prev, [campo]: valor }));
  }

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
              <div className="modal-sub">Escolha quais colunas vao preencher a nova venda.</div>
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
            <span>Valor que sera levado</span>
          </div>

          <div className="lead-sale-map-list">
            {CAMPOS_VENDA_LEAD.map(campo => {
              const coluna = mapeamento[campo.name] || '';
              const valor = getValorLeadPorNome(linha, coluna);

              return (
                <div key={campo.name} className="lead-sale-map-row">
                  <label>{campo.label}</label>
                  <select value={coluna} onChange={event => atualizarMapeamento(campo.name, event.target.value)}>
                    <option value="">Nao preencher</option>
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

function LeadAtualizacaoModal({ dados, salvando, erro, onClose, onSave }) {
  const [valor, setValor] = useState(dados?.valorAtualizado || '');

  if (!dados) return null;

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
              <div className="modal-client">Atualizar informacao</div>
              <div className="modal-sub">{dados.label}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="lead-update-summary">
            <span>Informacao original</span>
            <strong>{dados.valorOriginal || '-'}</strong>
          </div>

          <div className="form-field">
            <label>Informacao atualizada</label>
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

function LeadsRecebidosView() {
  const navigate = useNavigate();
  const [envios, setEnvios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalAtualizacao, setModalAtualizacao] = useState(null);
  const [salvandoAtualizacao, setSalvandoAtualizacao] = useState(false);
  const [erroAtualizacao, setErroAtualizacao] = useState('');
  const [modalVenda, setModalVenda] = useState(null);
  const usuario = useMemo(() => getUsuarioLocal(), []);
  const podeRegistrarVenda = temPermissao(usuario, 'vendas_criar');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarMeusLeadEnvios()
      .then(data => {
        if (!cancelado) setEnvios(data);
      })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (selecionados.length === 0) {
      setLinhas([]);
      setTotalLinhas(0);
      return;
    }

    let cancelado = false;
    setCarregando(true);
    listarMinhasLeadLinhas({ envio_ids: selecionados, page: pagina, page_size: 200, busca })
      .then(data => {
        if (!cancelado) {
          setLinhas(data.data || []);
          setTotalLinhas(data.total || 0);
        }
      })
      .catch(error => setErro(error.message || 'Erro ao carregar leads recebidos.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [selecionados, pagina, busca]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const enviosSelecionados = useMemo(() => (
    envios.filter(envio => selecionados.includes(envio.id))
  ), [envios, selecionados]);

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

  const linhasFiltradas = useMemo(() => {
    return linhas;
  }, [linhas]);

  const totalPaginas = Math.max(1, Math.ceil(totalLinhas / 200));

  function toggleEnvio(id) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    setPagina(1);
  }

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

  async function salvarAtualizacao(valor) {
    if (!modalAtualizacao || !valor.trim()) {
      setErroAtualizacao('Informe a informacao atualizada.');
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
      setSucesso('Informacao atualizada salva.');
    } catch (error) {
      setErroAtualizacao(error.message || 'Erro ao atualizar lead recebido.');
    } finally {
      setSalvandoAtualizacao(false);
    }
  }

  function abrirRegistroVenda(linha) {
    setModalVenda(linha);
  }

  function continuarRegistroVenda(vendaPreenchida) {
    navigate('/vendas?nova=1', {
      state: {
        vendaPreenchida,
        origemLead: {
          linha_id: modalVenda?.id,
          envio: modalVenda?.envio?.nome || ''
        }
      }
    });
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

      {modalVenda && (
        <RegistrarVendaLeadModal
          linha={modalVenda}
          colunas={colunas}
          usuario={usuario}
          onClose={() => setModalVenda(null)}
          onConfirm={continuarRegistroVenda}
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
              <small>{new Date(envio.created_at).toLocaleDateString('pt-BR')} - {envio.total_linhas} leads</small>
            </button>
          ))}
          {!carregando && envios.length === 0 && (
            <div className="lead-doc-empty">Nenhum envio recebido.</div>
          )}
        </div>
      </div>

      <div className="clientes-leads-toolbar">
        <div className="clientes-toolbar__meta">
          {totalLinhas} lead(s) recebidos
        </div>
        <div className="clientes-leads-actions">
          <form className="clientes-search" onSubmit={event => event.preventDefault()}>
            <I.Search size={14} />
            <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar nos leads recebidos" />
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
                <th>Registrar venda</th>
                {colunas.map(coluna => <th key={getColunaKeyLeadRecebido(coluna)}>{getLabelColunaLeadRecebido(coluna)}</th>)}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Carregando leads...</td></tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr><td colSpan={colunas.length + 2} className="muted" style={{ textAlign: 'center', padding: 40 }}>Selecione uma planilha recebida.</td></tr>
              ) : (
                linhasFiltradas.map(linha => (
                  <tr key={linha.id}>
                    <td><span className="tag">{linha.envio?.nome || '-'}</span></td>
                    <td>
                      {podeRegistrarVenda ? (
                        <button type="button" className="lead-register-sale-btn" onClick={() => abrirRegistroVenda(linha)}>
                          Registrar venda
                        </button>
                      ) : '-'}
                    </td>
                    {colunas.map(coluna => {
                      const valor = getValorLeadRecebido(linha, coluna);
                      const key = getColunaKeyLeadRecebido(coluna);
                      const podeAtualizar = !coluna.atualizada && Boolean(getNomeColunaLeadRecebido(linha, coluna));

                      return (
                        <td key={key} className={coluna.atualizada ? 'lead-updated-cell' : ''}>
                          {coluna.atualizada || !podeAtualizar ? (
                            valor || '-'
                          ) : (
                            <button
                              type="button"
                              className="lead-cell-button"
                              onClick={() => abrirAtualizacao(linha, coluna)}
                              title="Atualizar informacao"
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
        <span>Pagina {pagina} de {totalPaginas}</span>
        <button className="btn" type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(prev => Math.min(totalPaginas, prev + 1))}>Proxima</button>
      </div>
    </div>
  );
}

function ClienteModal({ cliente, operadoras, onClose, onSave }) {
  const [form, setForm] = useState(() => normalizarClienteForm(cliente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [abaAtiva, setAbaAtiva] = useState('cliente');
  const ultimoCnpjConsultadoRef = useRef(sanitizarCnpj(cliente?.cnpj));
  const editando = Boolean(cliente);

  function atualizarCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function formatarMensagemCnpj(dados) {
    const totalFontes = dados.fontesComSucesso?.length || (dados.fonte ? 1 : 0);
    const origem = totalFontes > 1 ? `${totalFontes} fontes` : (dados.fonte || 'fonte publica');
    const cache = dados.cache ? ' Dados recentes do cache.' : '';

    return `Dados combinados de ${origem}. Confira antes de salvar.${cache}`;
  }

  function aplicarDadosCnpj(dados, sobrescrever = false) {
    setForm(prev => ({
      ...prev,
      nome: sobrescrever
        ? (dados.nomeFantasia || dados.razaoSocial || prev.nome || '')
        : (prev.nome || dados.nomeFantasia || dados.razaoSocial || ''),
      razao_social: sobrescrever ? (dados.razaoSocial || prev.razao_social || '') : (prev.razao_social || dados.razaoSocial || ''),
      email: sobrescrever ? (dados.email || prev.email || '') : (prev.email || dados.email || ''),
      whatsapp: sobrescrever
        ? (formatarTelefoneComDdd(dados.telefone, true) || prev.whatsapp || '')
        : (prev.whatsapp || formatarTelefoneComDdd(dados.telefone, true))
    }));
  }

  async function buscarDadosCnpj(manual = false) {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length !== 14) {
      if (manual) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'Informe um CNPJ com 14 digitos.' });
      }
      return;
    }

    if (isCnpjRepetido(cnpj)) {
      setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ invalido.' });
      return;
    }

    if (!manual && ultimoCnpjConsultadoRef.current === cnpj) {
      return;
    }

    ultimoCnpjConsultadoRef.current = cnpj;
    setConsultandoCnpj(true);
    setCnpjStatus({ tipo: 'info', mensagem: 'Buscando CNPJ...' });

    try {
      const dados = await consultarCnpj(cnpj);
      aplicarDadosCnpj(dados, manual);
      setCnpjStatus({
        tipo: 'sucesso',
        mensagem: formatarMensagemCnpj(dados)
      });
    } catch (error) {
      setCnpjStatus({ tipo: 'erro', mensagem: error.message || 'Nao foi possivel consultar o CNPJ.' });
    } finally {
      setConsultandoCnpj(false);
    }
  }

  useEffect(() => {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length === 0) {
      setCnpjStatus({ tipo: '', mensagem: '' });
      return;
    }

    if (cnpj.length === 14) {
      if (isCnpjRepetido(cnpj)) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ invalido.' });
        return;
      }

      buscarDadosCnpj(false);
    }
  }, [form.cnpj]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      await onSave(montarPayloadCliente(form));
    } catch (error) {
      setErro(error.message || 'Erro ao salvar cliente.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal cliente-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{editando ? 'Editar cliente' : 'Novo cliente'}</div>
              <div className="modal-sub">Atualize representantes, contatos e dados de fidelidade.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${abaAtiva === 'cliente' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('cliente')}
          >
            <I.User size={14} /> Cliente
          </button>
          <button
            type="button"
            className={`modal-tab ${abaAtiva === 'notas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('notas')}
          >
            <I.Note size={14} /> Notas
          </button>
        </div>

        <div className="modal-body">
          {abaAtiva === 'notas' ? (
            <NotasEntidadeTab tipo="cliente" entidadeId={cliente?.id} />
          ) : (
          <>
            <div className="cliente-form-grid">
            <div className="form-field">
              <label>Nome</label>
              <input value={form.nome} onChange={event => atualizarCampo('nome', event.target.value)} required />
            </div>

            <div className="form-field">
              <label>Razao social</label>
              <AutoResizeTextarea
                value={form.razao_social}
                onChange={event => atualizarCampo('razao_social', event.target.value)}
                maxRows={4}
              />
            </div>

            <div className="form-field">
              <label>CNPJ</label>
              <input
                value={form.cnpj}
                onChange={event => atualizarCampo('cnpj', formatarCnpj(event.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
              />
              <div className="cnpj-lookup-row">
                {cnpjStatus.mensagem && (
                  <span className={`field-hint cnpj-lookup-status ${cnpjStatus.tipo}`}>
                    {cnpjStatus.mensagem}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => buscarDadosCnpj(true)}
                  disabled={consultandoCnpj || sanitizarCnpj(form.cnpj).length !== 14}
                >
                  {consultandoCnpj ? 'Buscando...' : cnpjStatus.tipo === 'erro' ? 'Tentar novamente' : 'Buscar dados'}
                </button>
              </div>
            </div>

            <div className="form-field">
              <label>Operadora atual</label>
              <select value={form.operadora_atual_id} onChange={event => atualizarCampo('operadora_atual_id', event.target.value)}>
                <option value="">Selecione</option>
                {operadoras.map(operadora => (
                  <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Tipo</label>
              <select value={form.responsavel_tipo} onChange={event => atualizarCampo('responsavel_tipo', event.target.value)}>
                <option value="rl">RL</option>
                <option value="adm">ADM</option>
              </select>
            </div>

            <div className="form-field">
              <label>Nome do ADM/RL</label>
              <input value={form.responsavel_nome} onChange={event => atualizarCampo('responsavel_nome', event.target.value)} />
            </div>

            <div className="form-field span-2">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={event => atualizarCampo('email', event.target.value)} />
            </div>

            <div className="form-field">
              <label>WhatsApp com DDD</label>
              <input
                value={form.whatsapp}
                onChange={event => atualizarCampo('whatsapp', formatarTelefoneComDdd(event.target.value, true))}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                maxLength={15}
              />
            </div>

            <div className="form-field">
              <label>Fixo com DDD</label>
              <input
                value={form.fixo}
                onChange={event => atualizarCampo('fixo', formatarTelefoneComDdd(event.target.value))}
                placeholder="(11) 9999-9999"
                inputMode="numeric"
                maxLength={14}
              />
            </div>

            <div className="form-field">
              <label>Quantidade de chip</label>
              <input type="number" min="0" value={form.quantidade_chips} onChange={event => atualizarCampo('quantidade_chips', event.target.value)} />
            </div>

            <div className="form-field">
              <label>Fim da fidelidade</label>
              <input type="date" value={form.fidelidade_fim} onChange={event => atualizarCampo('fidelidade_fim', event.target.value)} />
            </div>
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
          </>
          )}
        </div>

        <div className="modal-footer">
          {abaAtiva === 'notas' ? (
            <button type="button" className="btn" onClick={onClose}>Fechar</button>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar cliente'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function ConfirmarLixeiraModal({ cliente, excluindo, onClose, onConfirm }) {
  if (!cliente) return null;

  return (
    <div className="modal-overlay" onClick={event => !excluindo && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Enviar cliente para a lixeira?</div>
              <div className="modal-sub">{cliente.nome} - #{cliente.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={excluindo}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="trash-warning">
            <I.AlertTriangle size={20} />
            <div>
              <strong>Este cliente sera enviado para a lixeira.</strong>
              <span>Ele ficara disponivel para restauracao e sera permanentemente deletado daqui a 1 mes.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={excluindo}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={excluindo}>
            {excluindo ? 'Enviando...' : 'Enviar para lixeira'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Clientes() {
  const navigate = useNavigate();
  const usuario = getUsuarioLocal();

  const podeCriar = temPermissao(usuario, 'clientes_criar');
  const podeEditar = temPermissao(usuario, 'clientes_editar');
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');

  const [clientes, setClientes] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [busca, setBusca] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [responsavelTipo, setResponsavelTipo] = useState('');
  const [fidelidade, setFidelidade] = useState('');
  const [chipsMin, setChipsMin] = useState('');
  const [chipsMax, setChipsMax] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [clienteModal, setClienteModal] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteParaLixeira, setClienteParaLixeira] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('clientes');

  const filtros = useMemo(() => ({
    busca,
    operadora_atual_id: operadoraId,
    responsavel_tipo: responsavelTipo,
    fidelidade,
    chips_min: chipsMin,
    chips_max: chipsMax
  }), [busca, operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = useMemo(() => (
    [operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]
      .filter(v => v !== '').length
  ), [operadoraId, responsavelTipo, fidelidade, chipsMin, chipsMax]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  async function carregarClientes(proximosFiltros = filtros) {
    setErro('');
    setCarregando(true);

    try {
      const [dados, operadorasData] = await Promise.all([
        listarClientes(proximosFiltros),
        listarOperadoras()
      ]);
      setClientes(dados);
      setOperadoras(operadorasData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarClientes();
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const clientesComAviso = useMemo(() => (
    clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar).length
  ), [clientes]);

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes(filtros);
  }

  function limparFiltros() {
    setBusca('');
    setOperadoraId('');
    setResponsavelTipo('');
    setFidelidade('');
    setChipsMin('');
    setChipsMax('');
  }

  function abrirNovoCliente() {
    setClienteModal(null);
    setModalAberto(true);
  }

  function abrirEdicaoCliente(cliente) {
    if (!podeEditar) return;
    setClienteModal(cliente);
    setModalAberto(true);
  }

  async function salvarCliente(dados) {
    setErro('');
    const editando = Boolean(clienteModal);

    if (clienteModal) {
      await atualizarCliente(clienteModal.id, dados);
    } else {
      await criarCliente(dados);
    }

    setModalAberto(false);
    setClienteModal(null);
    await carregarClientes(filtros);
    setSucesso(editando ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
  }

  async function confirmarExclusaoCliente() {
    if (!clienteParaLixeira) return;

    setExcluindo(true);
    try {
      await excluirCliente(clienteParaLixeira.id);
      setClientes(prev => prev.filter(item => item.id !== clienteParaLixeira.id));
      setClienteParaLixeira(null);
      setSucesso('Cliente enviado para a lixeira.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir cliente.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <LayoutPrivado>
      {modalAberto && (
        <ClienteModal
          cliente={clienteModal}
          operadoras={operadoras}
          onClose={() => setModalAberto(false)}
          onSave={salvarCliente}
        />
      )}

      <ConfirmarLixeiraModal
        cliente={clienteParaLixeira}
        excluindo={excluindo}
        onClose={() => setClienteParaLixeira(null)}
        onConfirm={confirmarExclusaoCliente}
      />

      {filtrosAbertos && (
        <div className="filtros-popup-overlay" onClick={() => setFiltrosAbertos(false)}>
          <div className="filtros-popup" onClick={e => e.stopPropagation()}>
            <div className="filtros-popup__header">
              <span>Filtros</span>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setFiltrosAbertos(false)}>
                <I.Close size={14} />
              </button>
            </div>
            <div className="filtros-popup__body">
              <div className="filter-field">
                <label>Operadora</label>
                <select value={operadoraId} onChange={e => setOperadoraId(e.target.value)}>
                  <option value="">Todas</option>
                  {operadoras.map(operadora => (
                    <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Responsavel</label>
                <select value={responsavelTipo} onChange={e => setResponsavelTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="rl">RL</option>
                  <option value="adm">ADM</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Fidelidade</label>
                <select value={fidelidade} onChange={e => setFidelidade(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="ativa">Ativa</option>
                  <option value="alerta">Com alerta</option>
                  <option value="vencida">Vencida</option>
                  <option value="sem">Sem fidelidade</option>
                </select>
              </div>
              <div className="filter-field">
                <label>Chips min.</label>
                <input type="number" min="0" value={chipsMin} onChange={e => setChipsMin(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>Chips max.</label>
                <input type="number" min="0" value={chipsMax} onChange={e => setChipsMax(e.target.value)} />
              </div>
            </div>
            <div className="filtros-popup__footer">
              <button type="button" className="btn btn-ghost" onClick={limparFiltros} disabled={filtrosPopupAtivos === 0}>
                <I.Close size={13} /> Limpar filtros
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFiltrosAbertos(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="clientes-page">
        <div className="clientes-tabs">
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'clientes' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('clientes')}
          >
            Clientes cadastrados
          </button>
          <button
            type="button"
            className={`clientes-tab ${abaAtiva === 'leads' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('leads')}
          >
            Leads recebidos
          </button>
        </div>

        {abaAtiva === 'leads' ? (
          <LeadsRecebidosView />
        ) : (
          <>
        <div className="clientes-toolbar">
          <div className="clientes-toolbar__meta">
            {clientes.length} clientes cadastrados
            {clientesComAviso > 0 ? ` - ${clientesComAviso} aviso(s) de fidelidade` : ''}
            {filtrosAtivos > 0 ? ` - ${filtrosAtivos} filtro(s) ativo(s)` : ''}
          </div>

          <div className="clientes-toolbar__actions">
            <form className="clientes-search" onSubmit={handleBuscar}>
              <I.Search size={14} />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder="Buscar por nome, CNPJ, e-mail..."
              />
            </form>

            <button className="btn" type="button" onClick={() => setFiltrosAbertos(true)}>
              <I.Filter size={14} /> Filtros
              {filtrosPopupAtivos > 0 && <span className="filtros-count">{filtrosPopupAtivos}</span>}
            </button>

            {podeCriar && (
              <button className="btn btn-primary" onClick={abrirNovoCliente}>
                <I.Plus size={14} /> Novo cliente
              </button>
            )}

            {podeExcluir && (
              <button className="btn btn-danger" onClick={() => navigate('/clientes/lixeira')}>
                <I.Trash size={14} /> Lixeira
              </button>
            )}
          </div>
        </div>

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error">{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Responsavel</th>
                  <th>Contato</th>
                  <th>Operadora</th>
                  <th>Registrado por</th>
                  <th>Chips</th>
                  <th>Fidelidade</th>
                  {podeExcluir && <th>Excluir</th>}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeExcluir ? 8 : 7} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={podeExcluir ? 8 : 7} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => {
                    const contato = formatarContato(cliente);
                    const fidelidade = formatarFidelidade(cliente.aviso_fidelidade);

                    return (
                      <tr
                        key={cliente.id}
                        className={podeEditar ? 'clickable-row' : ''}
                        role={podeEditar ? 'button' : undefined}
                        tabIndex={podeEditar ? 0 : undefined}
                        onClick={() => abrirEdicaoCliente(cliente)}
                        onKeyDown={(event) => {
                          if (!podeEditar) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            abrirEdicaoCliente(cliente);
                          }
                        }}
                      >
                        <td>
                          <div className="cliente-primary">
                            <strong>{cliente.nome}</strong>
                            <span>{cliente.razao_social || 'Sem razao social'} - {cliente.cnpj || 'Sem CNPJ'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="tag">{cliente.responsavel_tipo === 'adm' ? 'ADM' : 'RL'}</span>{' '}
                          {cliente.responsavel_nome || '-'}
                        </td>
                        <td>
                          <div className="cliente-contact">
                            <span>{cliente.email || '-'}</span>
                            <span>{contato.whatsapp || contato.fixo || '-'}</span>
                          </div>
                        </td>
                        <td>{cliente.operadoraAtual?.nome || '-'}</td>
                        <td>
                          <span className="tag">{cliente.criador?.nome || 'Sem registro'}</span>
                        </td>
                        <td>{cliente.quantidade_chips ?? '-'}</td>
                        <td>
                          <span className={`pill ${fidelidade.className}`}>
                            <span className="pill-dot"></span>
                            {fidelidade.label}
                          </span>
                        </td>
                        {podeExcluir && (
                          <td>
                            <div className="clientes-actions">
                              <button
                                className="btn btn-icon btn-ghost btn-danger-icon"
                                title="Excluir"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setClienteParaLixeira(cliente);
                                }}
                              >
                                <I.Trash size={13} />
                              </button>
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
          </>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default Clientes;
