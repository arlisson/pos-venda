import { useEffect, useRef, useState } from 'react';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import CnpjSugestoes, { formatarMensagemResumoCnpj } from '../../components/CnpjSugestoes';
import { consultarCnpj, sanitizarCnpj, validarDigitosCnpj } from '../../services/cnpj.service';
import { criarCliente, atualizarCliente } from '../../services/cliente.service';
import { criarNotaEntidade } from '../../services/nota.service';
import { listarVendas } from '../../services/venda.service';
import { useFormDraft } from '../../utils/useFormDraft';
import SelectFiltro from '../../components/SelectFiltro/SelectFiltro';
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
  valor_pago: '',
  quantidade_chips: '',
  operadoras_atuais: []
};

const CNPJ_SUGESTOES_CLIENTE = {
  nomeFantasia: { campo: 'nome', label: 'Nome fantasia' },
  razaoSocial: { campo: 'razao_social', label: 'Razão social' },
  email: { campo: 'email', label: 'E-mail' },
  telefone: { campo: 'telefone', label: 'Telefone' },
};

const CNPJ_LABELS_CLIENTE = Object.fromEntries(
  Object.entries(CNPJ_SUGESTOES_CLIENTE).map(([campo, config]) => [campo, config.label])
);

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

function parseValorInput(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function formatarInputMoedaBR(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) return '';

  return (Number(digitos) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarValorPagoInput(valor) {
  if (valor === undefined || valor === null || valor === '') return '';

  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function novaOperadoraCliente(dados = {}) {
  return {
    operadora_id: dados.operadora_id ? String(dados.operadora_id) : '',
    quantidade_chips: dados.quantidade_chips ?? '',
    valor_pago: formatarValorPagoInput(dados.valor_pago),
    fidelidade_fim: normalizarDataInput(dados.fidelidade_fim)
  };
}

function normalizarOperadorasClienteForm(cliente) {
  const operadorasCliente = cliente?.operadoras_atuais || cliente?.operadorasAtuais || [];
  if (Array.isArray(operadorasCliente) && operadorasCliente.length > 0) {
    return operadorasCliente.map(novaOperadoraCliente);
  }

  if (cliente?.operadora_atual_id || cliente?.quantidade_chips || cliente?.valor_pago || cliente?.fidelidade_fim) {
    return [novaOperadoraCliente({
      operadora_id: cliente.operadora_atual_id,
      quantidade_chips: cliente.quantidade_chips,
      valor_pago: cliente.valor_pago,
      fidelidade_fim: cliente.fidelidade_fim
    })];
  }

  return [];
}

function montarPayloadCliente(form) {
  const whatsapp = separarTelefone(form.whatsapp);
  const fixo = separarTelefone(form.fixo);
  const operadorasAtuais = (form.operadoras_atuais || [])
    .filter(item => item.operadora_id)
    .map(item => ({
      operadora_id: Number(item.operadora_id),
      quantidade_chips: item.quantidade_chips !== '' ? Number(item.quantidade_chips) : null,
      valor_pago: parseValorInput(item.valor_pago),
      fidelidade_fim: item.fidelidade_fim || null
    }));

  return {
    ...form,
    cnpj: formatarCnpj(form.cnpj),
    whatsapp_ddd: whatsapp.ddd,
    whatsapp_numero: whatsapp.numero,
    fixo_ddd: fixo.ddd,
    fixo_numero: fixo.numero,
    operadoras_atuais: operadorasAtuais,
    fidelidade_fim: operadorasAtuais[0]?.fidelidade_fim || null,
    operadora_atual_id: operadorasAtuais[0]?.operadora_id || null,
    valor_pago: operadorasAtuais.reduce((total, item) => total + Number(item.valor_pago || 0), 0) || null,
    quantidade_chips: operadorasAtuais.reduce((total, item) => total + Number(item.quantidade_chips || 0), 0) || null
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
    valor_pago: formatarValorPagoInput(cliente.valor_pago),
    quantidade_chips: cliente.quantidade_chips ?? '',
    operadoras_atuais: normalizarOperadorasClienteForm(cliente)
  };
}

function formatarDataVenda(valor) {
  if (!valor) return '-';

  const texto = String(valor).slice(0, 10);
  const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';

  return data.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
  if (valor === undefined || valor === null || valor === '') return '-';

  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function obterTimestampVenda(venda) {
  const valor = venda.data_venda || venda.criado_em || venda.created_at;
  if (!valor) return 0;

  const texto = String(valor);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(texto.slice(0, 10))
    ? new Date(`${texto.slice(0, 10)}T00:00:00`)
    : new Date(valor);

  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

function ordenarVendasRecentes(vendas) {
  return [...(vendas || [])].sort((a, b) => (
    obterTimestampVenda(b) - obterTimestampVenda(a) || Number(b.id || 0) - Number(a.id || 0)
  ));
}

function obterTituloVenda(venda) {
  return venda.servico?.nome || venda.produto_fechado || venda.tipoVenda?.nome || `Venda #${venda.id}`;
}

function obterResponsaveisVenda(venda) {
  const nomes = Array.isArray(venda.vendedoras)
    ? venda.vendedoras.map(item => item?.nome).filter(Boolean)
    : [];

  if (nomes.length > 0) return nomes.join(', ');
  return venda.vendedora?.nome || venda.criador?.nome || '-';
}

function ClienteModal({ cliente, operadoras, onClose, onSave, initialTab = 'cliente', initialDraft = null, onDraftChange, notesOnly = false, onOpenVenda }) {
  const editando = Boolean(cliente);
  const draftKey = 'cliente_novo';

  const [form, setForm] = useState(() => {
    const base = normalizarClienteForm(cliente);
    if (editando) {
      return base;
    }

    // Para novo cliente, tenta carregar rascunho salvo, depois initialDraft, depois formulário vazio
    let savedDraft = null;
    try {
      const draft = localStorage.getItem(`form_draft_${draftKey}`);
      savedDraft = draft ? JSON.parse(draft) : null;
    } catch {
      // Ignora erros ao carregar do localStorage
    }

    return { ...base, ...(savedDraft || initialDraft || {}) };
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [cnpjDados, setCnpjDados] = useState(null);
  const [cnpjSugestoes, setCnpjSugestoes] = useState({});
  const [abaAtiva, setAbaAtiva] = useState(notesOnly ? 'notas' : initialTab);
  const [pendingNotas, setPendingNotas] = useState([]);
  const [vendasCliente, setVendasCliente] = useState([]);
  const [carregandoVendas, setCarregandoVendas] = useState(false);
  const [erroVendas, setErroVendas] = useState('');
  const ultimoCnpjConsultadoRef = useRef(sanitizarCnpj(cliente?.cnpj));
  const podeMostrarHistoricoVendas = Boolean(cliente?.id && onOpenVenda);

  // Usar hook para persistência de rascunhos
  const { clearDraft } = useFormDraft(editando ? null : draftKey, form, editando);

  useEffect(() => {
    if (editando || !onDraftChange) return;
    onDraftChange(form);
  }, [editando, form, onDraftChange]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (abaAtiva !== 'vendas' || !cliente?.id) return undefined;

    let ativo = true;
    setCarregandoVendas(true);
    setErroVendas('');

    listarVendas({ cliente_id: cliente.id })
      .then(data => {
        if (!ativo) return;
        const lista = Array.isArray(data) ? data : (data?.data || []);
        setVendasCliente(ordenarVendasRecentes(lista));
      })
      .catch(error => {
        if (ativo) setErroVendas(error.message || 'Erro ao carregar vendas do cliente.');
      })
      .finally(() => {
        if (ativo) setCarregandoVendas(false);
      });

    return () => {
      ativo = false;
    };
  }, [abaAtiva, cliente?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleClose() {
    if (!editando && onDraftChange) {
      onDraftChange(form);
    }

    onClose();
  }

  function limparDadosCliente() {
    if (editando || salvando) return;

    const formLimpo = { ...FORM_INICIAL };

    clearDraft();
    setForm(formLimpo);
    onDraftChange?.(formLimpo);
    setErro('');
    setCnpjStatus({ tipo: '', mensagem: '' });
    setCnpjDados(null);
    setCnpjSugestoes({});
    setPendingNotas([]);
    setAbaAtiva('cliente');
    ultimoCnpjConsultadoRef.current = '';
  }

  function atualizarCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function adicionarOperadoraCliente() {
    setForm(prev => ({
      ...prev,
      operadoras_atuais: [...(prev.operadoras_atuais || []), novaOperadoraCliente()]
    }));
  }

  function atualizarOperadoraCliente(index, campo, valor) {
    setForm(prev => ({
      ...prev,
      operadoras_atuais: (prev.operadoras_atuais || []).map((item, idx) => (
        idx === index ? { ...item, [campo]: valor } : item
      ))
    }));
  }

  function removerOperadoraCliente(index) {
    setForm(prev => ({
      ...prev,
      operadoras_atuais: (prev.operadoras_atuais || []).filter((_, idx) => idx !== index)
    }));
  }

  function formatarMensagemCnpj(dados) {
    return formatarMensagemResumoCnpj(dados);
  }

  function montarSugestoesCnpj(dados) {
    return Object.entries(CNPJ_SUGESTOES_CLIENTE).reduce((acc, [campoApi]) => {
      const valor = dados[campoApi];
      if (String(valor || '').trim()) acc[campoApi] = valor;
      return acc;
    }, {});
  }

  function aceitarSugestaoCnpj(campoApi) {
    const valor = cnpjSugestoes[campoApi];
    const config = CNPJ_SUGESTOES_CLIENTE[campoApi];
    if (!config || !String(valor || '').trim()) return;

    setForm(prev => {
      if (campoApi === 'telefone') {
        const digitos = apenasDigitos(valor, 11);
        const campoTelefone = digitos.length > 10 ? 'whatsapp' : 'fixo';
        return {
          ...prev,
          [campoTelefone]: formatarTelefoneComDdd(valor, digitos.length > 10)
        };
      }

      return {
        ...prev,
        [config.campo]: valor
      };
    });

    setCnpjSugestoes(prev => {
      const proximo = { ...prev };
      delete proximo[campoApi];
      return proximo;
    });
  }

  function recusarSugestaoCnpj(campoApi) {
    setCnpjSugestoes(prev => {
      const proximo = { ...prev };
      delete proximo[campoApi];
      return proximo;
    });
  }

  async function buscarDadosCnpj(manual = false) {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length !== 14) {
      if (manual) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'Informe um CNPJ com 14 dígitos.' });
      }
      return;
    }

    if (!validarDigitosCnpj(cnpj)) {
      setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
      setCnpjDados(null);
      setCnpjSugestoes({});
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
      setCnpjDados(dados);
      setCnpjSugestoes(montarSugestoesCnpj(dados));
      setCnpjStatus({
        tipo: 'sucesso',
        mensagem: formatarMensagemCnpj(dados)
      });
    } catch (error) {
      setCnpjDados(null);
      setCnpjSugestoes({});
      setCnpjStatus({ tipo: 'erro', mensagem: error.message || 'Não foi possível consultar o CNPJ.' });
    } finally {
      setConsultandoCnpj(false);
    }
  }

  useEffect(() => {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length === 0) {
      setCnpjStatus({ tipo: '', mensagem: '' });
      setCnpjDados(null);
      setCnpjSugestoes({});
      return;
    }

    if (cnpj.length === 14) {
      if (!validarDigitosCnpj(cnpj)) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
        setCnpjDados(null);
        setCnpjSugestoes({});
        return;
      }

      setCnpjStatus({ tipo: '', mensagem: '' });
      setCnpjDados(null);
      setCnpjSugestoes({});

      const timeout = setTimeout(() => {
        buscarDadosCnpj(false);
      }, 450);

      return () => clearTimeout(timeout);
    }
  }, [form.cnpj]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');

    if (!form.nome.trim()) {
      setErro('Preencha o nome do cliente.');
      setAbaAtiva('cliente');
      return;
    }

    const cnpj = sanitizarCnpj(form.cnpj);
    if (cnpj.length !== 14) {
      setErro('Informe um CNPJ com 14 digitos.');
      setCnpjStatus({ tipo: 'erro', mensagem: 'Informe um CNPJ com 14 digitos.' });
      setAbaAtiva('cliente');
      return;
    }

    if (!validarDigitosCnpj(cnpj)) {
      setErro('CNPJ invalido.');
      setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ invalido.' });
      setAbaAtiva('cliente');
      return;
    }

    setSalvando(true);

    try {
      const payload = montarPayloadCliente(form);
      let saved;

      if (cliente?.id) {
        saved = await atualizarCliente(cliente.id, payload);
      } else {
        saved = await criarCliente(payload);
        for (const nota of pendingNotas) {
          try {
            await criarNotaEntidade('cliente', saved.id, nota);
          } catch {
            // best effort
          }
        }
      }

      // Limpar rascunho após sucesso
      if (!cliente?.id) {
        localStorage.removeItem(`form_draft_${draftKey}`);
      }

      await onSave(saved);
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
              <div className="modal-client">{notesOnly ? 'Notas do cliente' : editando ? 'Editar cliente' : 'Novo cliente'}</div>
              <div className="modal-sub">
                {notesOnly
                  ? (cliente?.nome || cliente?.razao_social || `Cliente #${cliente?.id}`)
                  : 'Atualize representantes, contatos e dados de fidelidade.'}
              </div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={handleClose} disabled={salvando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        {!notesOnly && (
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
            <I.Note size={14} /> Notas{!cliente?.id && pendingNotas.length > 0 && ` (${pendingNotas.length})`}
          </button>
          {podeMostrarHistoricoVendas && (
            <button
              type="button"
              className={`modal-tab ${abaAtiva === 'vendas' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('vendas')}
            >
              <I.History size={14} /> Vendas
            </button>
          )}
        </div>
        )}

        <div className="modal-body">
          {erro && <div className="alert-error" style={{ marginBottom: 12 }}>{erro}</div>}
          {abaAtiva === 'notas' ? (
            <NotasEntidadeTab
              tipo="cliente"
              entidadeId={cliente?.id}
              pendingNotas={pendingNotas}
              onPendingNotasChange={setPendingNotas}
            />
          ) : abaAtiva === 'vendas' ? (
            <div className="cliente-vendas-history">
              {erroVendas && <div className="alert-error">{erroVendas}</div>}

              {carregandoVendas ? (
                <div className="cliente-vendas-empty">Carregando vendas...</div>
              ) : vendasCliente.length === 0 ? (
                <div className="cliente-vendas-empty">Nenhuma venda encontrada para este cliente.</div>
              ) : (
                <div className="cliente-vendas-list">
                  {vendasCliente.map(venda => (
                    <button
                      type="button"
                      key={venda.id}
                      className="cliente-venda-item"
                      onClick={() => onOpenVenda?.(venda)}
                    >
                      <span className="cliente-venda-item__date">{formatarDataVenda(venda.data_venda || venda.created_at)}</span>
                      <span className="cliente-venda-item__main">
                        <strong>{obterTituloVenda(venda)}</strong>
                        <small>
                          Protocolo {venda.protocolo || '-'} - {obterResponsaveisVenda(venda)}
                        </small>
                      </span>
                      <span className="cliente-venda-item__meta">
                        <strong>{formatarMoeda(venda.valor_total)}</strong>
                        <small>{venda.status_funil || 'sem etapa'}</small>
                      </span>
                      <I.ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
            <div className="cliente-form-grid">
            <div className="form-field">
              <label>Nome</label>
              <input value={form.nome} onChange={event => atualizarCampo('nome', event.target.value)} required />
            </div>

            <div className="form-field">
              <label>Razão social</label>
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
                required
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => buscarDadosCnpj(true)}
                disabled={consultandoCnpj || sanitizarCnpj(form.cnpj).length !== 14}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                {consultandoCnpj ? 'Buscando...' : 'Buscar dados do CNPJ'}
              </button>
              {cnpjStatus.mensagem && (
                <span className={`field-hint cnpj-lookup-status ${cnpjStatus.tipo}`}>
                  {cnpjStatus.mensagem}
                </span>
              )}
            </div>

            <div className="form-field">
              <label>Tipo</label>
              <SelectFiltro
                value={form.responsavel_tipo || 'rl'}
                onChange={val => atualizarCampo('responsavel_tipo', val || 'rl')}
                placeholder="RL"
                options={[
                  { value: 'rl', label: 'RL' },
                  { value: 'adm', label: 'ADM' },
                ]}
              />
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

            <div className="form-field span-2 cliente-operadoras-field">
              <div className="cliente-operadoras-head">
                <label>Operadoras contratadas</label>
                <button type="button" className="btn btn-sm" onClick={adicionarOperadoraCliente}>
                  <I.Plus size={13} /> Adicionar
                </button>
              </div>

              {(form.operadoras_atuais || []).length === 0 ? (
                <div className="cliente-operadoras-empty">Nenhuma operadora cadastrada.</div>
              ) : (
                <div className="cliente-operadoras-list">
                  {(form.operadoras_atuais || []).map((item, index) => (
                    <div className="cliente-operadora-row" key={`operadora-${index}`}>
                      <div className="form-field">
                        <label>Operadora</label>
                        <SelectFiltro
                          value={item.operadora_id ? String(item.operadora_id) : ''}
                          onChange={val => atualizarOperadoraCliente(index, 'operadora_id', val)}
                          placeholder="Selecione"
                          options={operadoras.map(op => ({ value: String(op.id), label: op.nome }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Chips</label>
                        <input
                          type="number"
                          min="0"
                          value={item.quantidade_chips}
                          onChange={event => atualizarOperadoraCliente(index, 'quantidade_chips', event.target.value)}
                        />
                      </div>
                      <div className="form-field">
                        <label>Valor pago</label>
                        <input
                          value={item.valor_pago}
                          onChange={event => atualizarOperadoraCliente(index, 'valor_pago', formatarInputMoedaBR(event.target.value))}
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="form-field">
                        <label>Fim da fidelidade</label>
                        <input
                          type="date"
                          value={item.fidelidade_fim}
                          onChange={event => atualizarOperadoraCliente(index, 'fidelidade_fim', event.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost btn-danger-icon cliente-operadora-remove"
                        onClick={() => removerOperadoraCliente(index)}
                        title="Remover operadora"
                      >
                        <I.Trash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <CnpjSugestoes
            dados={cnpjDados}
            sugestoes={cnpjSugestoes}
            labels={CNPJ_LABELS_CLIENTE}
            onAceitar={aceitarSugestaoCnpj}
            onRecusar={recusarSugestaoCnpj}
          />

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
          </>
          )}
        </div>

        <div className="modal-footer">
          {['notas', 'vendas'].includes(abaAtiva) && cliente?.id ? (
            <button type="button" className="btn" onClick={handleClose}>Fechar</button>
          ) : (
            <>
              {!editando && (
                <button type="button" className="btn btn-ghost" onClick={limparDadosCliente} disabled={salvando}>
                  <I.Trash size={14} /> Limpar Dados
                </button>
              )}
              <button type="button" className="btn" onClick={handleClose} disabled={salvando}>Cancelar</button>
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

export default ClienteModal;
