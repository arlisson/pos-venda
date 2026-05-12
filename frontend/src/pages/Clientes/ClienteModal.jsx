import { useEffect, useRef, useState } from 'react';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import CnpjSugestoes, { formatarMensagemResumoCnpj } from '../../components/CnpjSugestoes';
import { consultarCnpj, sanitizarCnpj, validarDigitosCnpj } from '../../services/cnpj.service';
import { criarCliente, atualizarCliente } from '../../services/cliente.service';
import { criarNotaEntidade } from '../../services/nota.service';
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
  quantidade_chips: ''
};

const CNPJ_SUGESTOES_CLIENTE = {
  nomeFantasia: { campo: 'nome', label: 'Nome fantasia' },
  razaoSocial: { campo: 'razao_social', label: 'Razão social' },
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
    valor_pago: parseValorInput(form.valor_pago),
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
    valor_pago: formatarValorPagoInput(cliente.valor_pago),
    quantidade_chips: cliente.quantidade_chips ?? ''
  };
}

function ClienteModal({ cliente, operadoras, onClose, onSave }) {
  const [form, setForm] = useState(() => normalizarClienteForm(cliente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [cnpjDados, setCnpjDados] = useState(null);
  const [cnpjSugestoes, setCnpjSugestoes] = useState({});
  const [abaAtiva, setAbaAtiva] = useState('cliente');
  const [pendingNotas, setPendingNotas] = useState([]);
  const ultimoCnpjConsultadoRef = useRef(sanitizarCnpj(cliente?.cnpj));
  const editando = Boolean(cliente);

  function atualizarCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
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

    setForm(prev => ({
      ...prev,
      [config.campo]: campoApi === 'telefone' ? formatarTelefoneComDdd(valor, true) : valor
    }));

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
            <I.Note size={14} /> Notas{!cliente?.id && pendingNotas.length > 0 && ` (${pendingNotas.length})`}
          </button>
        </div>

        <div className="modal-body">
          {erro && <div className="alert-error" style={{ marginBottom: 12 }}>{erro}</div>}
          {abaAtiva === 'notas' ? (
            <NotasEntidadeTab
              tipo="cliente"
              entidadeId={cliente?.id}
              pendingNotas={pendingNotas}
              onPendingNotasChange={setPendingNotas}
            />
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
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => buscarDadosCnpj(true)}
                disabled={consultandoCnpj || sanitizarCnpj(form.cnpj).length !== 14}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                {consultandoCnpj ? 'Buscando...' : 'Buscar nome e razao social'}
              </button>
              {cnpjStatus.mensagem && (
                <span className={`field-hint cnpj-lookup-status ${cnpjStatus.tipo}`}>
                  {cnpjStatus.mensagem}
                </span>
              )}
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
              <label>Valor pago</label>
              <input
                value={form.valor_pago}
                onChange={event => atualizarCampo('valor_pago', formatarInputMoedaBR(event.target.value))}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>

            <div className="form-field">
              <label>Fim da fidelidade</label>
              <input type="date" value={form.fidelidade_fim} onChange={event => atualizarCampo('fidelidade_fim', event.target.value)} />
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
          {abaAtiva === 'notas' && cliente?.id ? (
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

export default ClienteModal;
