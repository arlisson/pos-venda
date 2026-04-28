import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { buscarClientePorId, atualizarCliente, criarCliente } from '../../services/cliente.service';
import { listarOperadoras } from '../../services/config.service';
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

function normalizarDataInput(valor) {
  if (!valor) return '';

  const texto = String(valor).slice(0, 10);

  if (texto === '1899-11-30') {
    return '';
  }

  return texto;
}

function formatarTelefoneComDdd(valor, celular = false) {
  const limite = celular ? 11 : 10;
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, limite);

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

function montarPayload(form) {
  const whatsapp = separarTelefone(form.whatsapp);
  const fixo = separarTelefone(form.fixo);

  return {
    ...form,
    whatsapp_ddd: whatsapp.ddd,
    whatsapp_numero: whatsapp.numero,
    fixo_ddd: fixo.ddd,
    fixo_numero: fixo.numero,
    fidelidade_fim: form.fidelidade_fim || null,
    operadora_atual_id: form.operadora_atual_id ? Number(form.operadora_atual_id) : null,
    quantidade_chips: form.quantidade_chips !== '' ? Number(form.quantidade_chips) : null
  };
}

function ClienteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);

  const [form, setForm] = useState(FORM_INICIAL);
  const [operadoras, setOperadoras] = useState([]);
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      setErro('');
      setCarregando(true);

      try {
        const [operadorasData, clienteData] = await Promise.all([
          listarOperadoras(),
          editando ? buscarClientePorId(id) : Promise.resolve(null)
        ]);

        setOperadoras(operadorasData);

        if (clienteData) {
          setForm({
            nome: clienteData.nome || '',
            razao_social: clienteData.razao_social || '',
            cnpj: clienteData.cnpj || '',
            responsavel_tipo: clienteData.responsavel_tipo || 'rl',
            responsavel_nome: clienteData.responsavel_nome || '',
            email: clienteData.email || '',
            whatsapp: juntarTelefone(clienteData.whatsapp_ddd, clienteData.whatsapp_numero, true),
            fixo: juntarTelefone(clienteData.fixo_ddd, clienteData.fixo_numero),
            fidelidade_fim: normalizarDataInput(clienteData.fidelidade_fim),
            operadora_atual_id: clienteData.operadora_atual_id || '',
            quantidade_chips: clienteData.quantidade_chips ?? ''
          });
        }
      } catch (error) {
        setErro(error.message || 'Erro ao carregar cliente.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [editando, id]);

  const titulo = useMemo(() => editando ? 'Editar cliente' : 'Novo cliente', [editando]);

  function atualizarCampo(campo, valor) {
    setForm(prev => ({
      ...prev,
      [campo]: valor
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const payload = montarPayload(form);

      if (editando) {
        await atualizarCliente(id, payload);
      } else {
        await criarCliente(payload);
      }

      navigate('/clientes');
    } catch (error) {
      setErro(error.message || 'Erro ao salvar cliente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <LayoutPrivado>
      <div className="cliente-form-page">
        <section className="panel">
          <div className="cliente-form-header">
            <div className="cliente-form-header__title">
              <button
                className="btn btn-icon btn-ghost"
                type="button"
                onClick={() => navigate('/clientes')}
                title="Voltar"
              >
                <I.ArrowRight style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <h2>{titulo}</h2>
                <p>Cadastre representantes de empresas para vincular as vendas.</p>
              </div>
            </div>
          </div>

          <div className="panel-body">
            {erro && <div className="alert-error" style={{ margin: 18, marginBottom: 0 }}>{erro}</div>}

            {carregando ? (
              <div className="muted" style={{ padding: 24 }}>
                Carregando cliente...
              </div>
            ) : (
              <form className="cliente-form" onSubmit={handleSubmit}>
                <section className="cliente-form-section">
                  <div className="cliente-form-section__header">
                    <h3>Dados da empresa</h3>
                  </div>

                  <div className="cliente-form-grid">
                    <div className="form-field">
                      <label>Nome</label>
                      <input value={form.nome} onChange={event => atualizarCampo('nome', event.target.value)} required />
                    </div>

                    <div className="form-field">
                      <label>Razao social</label>
                      <input value={form.razao_social} onChange={event => atualizarCampo('razao_social', event.target.value)} />
                    </div>

                    <div className="form-field">
                      <label>CNPJ</label>
                      <input value={form.cnpj} onChange={event => atualizarCampo('cnpj', event.target.value)} />
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
                  </div>
                </section>

                <section className="cliente-form-section">
                  <div className="cliente-form-section__header">
                    <h3>Responsavel e contato</h3>
                  </div>

                  <div className="cliente-form-grid cliente-form-grid--three">
                    <div className="form-field">
                      <label>Tipo</label>
                      <select value={form.responsavel_tipo} onChange={event => atualizarCampo('responsavel_tipo', event.target.value)}>
                        <option value="rl">RL</option>
                        <option value="adm">ADM</option>
                      </select>
                    </div>

                    <div className="form-field span-2">
                      <label>Nome do ADM/RL</label>
                      <input value={form.responsavel_nome} onChange={event => atualizarCampo('responsavel_nome', event.target.value)} />
                    </div>

                    <div className="form-field span-3">
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
                        pattern="\([0-9]{2}\) [0-9]{5}-[0-9]{4}"
                        title="Informe o WhatsApp com DDD. Exemplo: (11) 99999-9999"
                      />
                    </div>

                    <div className="form-field">
                      <label>Quantidade de chip</label>
                      <input type="number" min="0" value={form.quantidade_chips} onChange={event => atualizarCampo('quantidade_chips', event.target.value)} />
                    </div>

                    <div className="form-field">
                      <label>Fixo com DDD</label>
                      <input
                        value={form.fixo}
                        onChange={event => atualizarCampo('fixo', formatarTelefoneComDdd(event.target.value))}
                        placeholder="(11) 9999-9999"
                        inputMode="numeric"
                        maxLength={14}
                        pattern="\([0-9]{2}\) [0-9]{4}-[0-9]{4}"
                        title="Informe o telefone fixo com DDD. Exemplo: (11) 9999-9999"
                      />
                    </div>

                    <div className="form-field">
                      <label>Fim da fidelidade</label>
                      <input type="date" value={form.fidelidade_fim} onChange={event => atualizarCampo('fidelidade_fim', event.target.value)} />
                    </div>
                  </div>
                </section>

                <div className="cliente-form-actions">
                  <button className="btn" type="button" onClick={() => navigate('/clientes')}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar cliente'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </LayoutPrivado>
  );
}

export default ClienteFormPage;
