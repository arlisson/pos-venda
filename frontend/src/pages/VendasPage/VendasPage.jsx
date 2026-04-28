import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import {
  atualizarVenda,
  criarVenda,
  deletarVenda,
  listarVendas,
  listarVendedoras
} from '../../services/venda.service';
import { listarOperadoras, listarServicos, listarTiposVenda } from '../../services/config.service';
import { listarClientes } from '../../services/cliente.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import './VendasPage.css';

const VENDA_VAZIA = {
  cliente_id: '',
  nome: '',
  telefone: '',
  email: '',
  email_2: '',
  nome_representante_legal: '',
  fixo_ddd: '',
  nome_fechou_venda: '',
  cpf_representante_legal: '',
  setor_funcao: '',
  produto_fechado: '',
  tipo_venda_id: '',
  servico_id: '',
  quantidade_linhas: '',
  ddd: '',
  numeros_portados: '',
  gb: '',
  valores_unitarios_chips: '',
  valor_total: '',
  ponto_referencia: '',
  tipo_local_cpf: '',
  razao_social: '',
  cnpj: '',
  data_venda: '',
  qc_feito_por: '',
  observacoes: '',
  dia_vencimento: '',
  endereco: '',
  numero_endereco: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  cep: '',
  horario_aceite_voz: '',
  responsavel_recebimento: '',
  rg_responsavel_recebimento: '',
  nome_administrador: '',
  cpf_administrador: '',
  operadora_id: '',
  vendedora_id: ''
};

const ITEM_CHIP_VAZIO = { quantidade: '', valor_unitario: '' };

const CAMPOS_CLIENTE_DERIVADOS = [
  'nome',
  'telefone',
  'email',
  'email_2',
  'nome_representante_legal',
  'fixo_ddd',
  'cpf_representante_legal',
  'razao_social',
  'cnpj',
  'nome_administrador',
  'cpf_administrador'
];

const CAMPOS = [
  { section: 'Cliente' },
  { name: 'cliente_id', label: 'Cliente', type: 'client', required: true, span: true },
  { name: 'vendedora_id', label: 'Vendedora', type: 'seller', required: true },

  { section: 'Dados da venda' },
  { name: 'data_venda', label: 'Data da venda', type: 'date' },
  { name: 'nome_fechou_venda', label: 'Nome com quem fechou a venda' },
  { name: 'setor_funcao', label: 'Setor/Funcao' },
  { name: 'qc_feito_por', label: 'QC feito por' },

  { section: 'Produto e valores' },
  { name: 'operadora_id', label: 'Operadora adquirida', type: 'operator', required: true },
  { name: 'tipo_venda_id', label: 'Tipo de venda', type: 'saleType', required: true },
  { name: 'servico_id', label: 'Servico', type: 'service', required: true },
  { name: 'quantidade_linhas', label: 'Quantidade de linhas fechadas', type: 'number' },
  { name: 'ddd', label: 'Qual DDD' },
  { name: 'gb', label: 'GB (Gigas)' },
  { name: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', min: 1, max: 31 },
  { name: 'valores_unitarios_chips', label: 'Valores unitarios de cada chip', type: 'chips', span: true },
  { name: 'numeros_portados', label: 'Numeros a serem portados', type: 'textarea', span: true },

  { section: 'Local de instalacao/entrega' },
  { name: 'endereco', label: 'Endereco' },
  { name: 'numero_endereco', label: 'Numero de endereco' },
  { name: 'complemento', label: 'Complemento' },
  { name: 'bairro', label: 'Bairro' },
  { name: 'municipio', label: 'Municipio' },
  { name: 'uf', label: 'UF', maxLength: 2 },
  { name: 'cep', label: 'CEP' },
  { name: 'ponto_referencia', label: 'Ponto de referencia', span: true },
  { name: 'tipo_local_cpf', label: 'Venda CPF: casa, hotel, condominio, shopping...', span: true },

  { section: 'Aceite e recebimento' },
  { name: 'horario_aceite_voz', label: 'Horario para aceite de voz' },
  { name: 'responsavel_recebimento', label: 'Responsavel pelo recebimento' },
  { name: 'rg_responsavel_recebimento', label: 'RG do responsavel pelo recebimento' },
  { name: 'observacoes', label: 'Observacoes', type: 'textarea', span: true },
];

function toInputDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatarData(value) {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const [ano, mes, dia] = date.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : value;
}

function formatarMoeda(value) {
  if (value === null || value === undefined || value === '') return '-';

  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function parseValorInput(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  return Number(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
}

function formatarInputMoedaBR(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) return '';

  const numero = Number(digitos) / 100;

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calcularTotalItensChips(itens = []) {
  return itens.reduce((acc, item) => (
    acc + (Number(item.quantidade || 0) * parseValorInput(item.valor_unitario))
  ), 0);
}

function parseItensChips(valor) {
  if (!valor) return [{ ...ITEM_CHIP_VAZIO }];

  if (Array.isArray(valor)) {
    const itens = valor.map(item => ({
      quantidade: item.quantidade ? String(item.quantidade) : '',
      valor_unitario: item.valor_unitario ? String(item.valor_unitario).replace('.', ',') : ''
    }));

    return itens.length > 0 ? itens : [{ ...ITEM_CHIP_VAZIO }];
  }

  if (typeof valor === 'string') {
    try {
      return parseItensChips(JSON.parse(valor));
    } catch {
      const itens = valor
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean)
        .map(linha => {
          const match = linha.match(/^(\d+)\s*x\s*([\d.,]+)$/i);

          if (!match) return null;

          return {
            quantidade: match[1],
            valor_unitario: match[2]
          };
        })
        .filter(Boolean);

      return itens.length > 0 ? itens : [{ ...ITEM_CHIP_VAZIO }];
    }
  }

  return [{ ...ITEM_CHIP_VAZIO }];
}

function normalizarVenda(venda) {
  return {
    ...VENDA_VAZIA,
    ...venda,
    data_venda: toInputDate(venda.data_venda),
    valor_total: venda.valor_total ?? '',
    valores_unitarios_chips: parseItensChips(venda.valores_unitarios_chips),
    quantidade_linhas: venda.quantidade_linhas ?? '',
    dia_vencimento: venda.dia_vencimento ?? '',
    operadora_id: venda.operadora_id ? String(venda.operadora_id) : '',
    tipo_venda_id: venda.tipo_venda_id ? String(venda.tipo_venda_id) : '',
    servico_id: venda.servico_id ? String(venda.servico_id) : '',
    vendedora_id: venda.vendedora_id ? String(venda.vendedora_id) : '',
    cliente_id: venda.cliente_id ? String(venda.cliente_id) : ''
  };
}

function ItensChipsInput({ value, onChange }) {
  const itens = Array.isArray(value) && value.length > 0 ? value : [{ ...ITEM_CHIP_VAZIO }];
  const total = calcularTotalItensChips(itens);

  function atualizarItem(index, campo, novoValor) {
    onChange(itens.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [campo]: novoValor } : item
    )));
  }

  function adicionarItem() {
    onChange([...itens, { ...ITEM_CHIP_VAZIO }]);
  }

  function removerItem(index) {
    const proximos = itens.filter((_, itemIndex) => itemIndex !== index);
    onChange(proximos.length > 0 ? proximos : [{ ...ITEM_CHIP_VAZIO }]);
  }

  return (
    <div className="chip-items">
      <div className="chip-items__head">
        <span>Quantidade</span>
        <span>Valor unitario</span>
        <span>Subtotal</span>
        <span></span>
      </div>

      {itens.map((item, index) => {
        const subtotal = Number(item.quantidade || 0) * parseValorInput(item.valor_unitario);

        return (
          <div key={index} className="chip-item-row">
            <input
              type="number"
              min="1"
              value={item.quantidade}
              onChange={e => atualizarItem(index, 'quantidade', e.target.value)}
              placeholder="3"
            />
            <input
              type="text"
              inputMode="decimal"
              value={item.valor_unitario}
              onChange={e => atualizarItem(index, 'valor_unitario', formatarInputMoedaBR(e.target.value))}
              placeholder="29,99"
            />
            <div className="chip-item-subtotal">{formatarMoeda(subtotal)}</div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => removerItem(index)} title="Remover item">
              <I.Trash size={13} />
            </button>
          </div>
        );
      })}

      <div className="chip-items__footer">
        <button type="button" className="btn btn-sm" onClick={adicionarItem}>
          <I.Plus size={13} /> Adicionar valor
        </button>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </div>
  );
}

function ClienteVendaSelect({ value, clientes, onChange }) {
  const [busca, setBusca] = useState('');
  const clienteSelecionado = clientes.find(cliente => String(cliente.id) === String(value));
  const buscaNormalizada = busca.trim().toLowerCase();
  const clientesFiltrados = clientes.filter(cliente => {
    if (!buscaNormalizada) return true;

    return [
      cliente.nome,
      cliente.razao_social,
      cliente.cnpj,
      cliente.email,
      cliente.responsavel_nome
    ].filter(Boolean).some(valor => String(valor).toLowerCase().includes(buscaNormalizada));
  });

  return (
    <div className="venda-cliente-select">
      <div className="venda-cliente-select__search">
        <I.Search size={14} />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Buscar cliente por nome, razao social, CNPJ ou e-mail"
        />
      </div>

      <select value={value} onChange={event => onChange(event.target.value)} required>
        <option value="">Selecione um cliente</option>
        {clientesFiltrados.map(cliente => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.nome} {cliente.razao_social ? `- ${cliente.razao_social}` : ''} {cliente.cnpj ? `- ${cliente.cnpj}` : ''}
          </option>
        ))}
      </select>

      {clientes.length === 0 && (
        <div className="venda-cliente-empty">
          Nenhum cliente disponivel. Cadastre um cliente ou solicite permissao para visualizar clientes.
        </div>
      )}

      {clienteSelecionado && (
        <div className="venda-cliente-card">
          <div>
            <strong>{clienteSelecionado.nome}</strong>
            <span>{clienteSelecionado.razao_social || 'Sem razao social'} - {clienteSelecionado.cnpj || 'Sem CNPJ'}</span>
          </div>
          <div>
            <span>{clienteSelecionado.email || 'Sem e-mail'}</span>
            <span>{clienteSelecionado.operadoraAtual?.nome || 'Sem operadora'} - {clienteSelecionado.quantidade_chips ?? 0} chips</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VendaModal({ venda, clientes, vendedoras, operadoras, tiposVenda, servicos, onClose, onSave }) {
  const [form, setForm] = useState(venda ? normalizarVenda(venda) : VENDA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function atualizarCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const payload = {
        ...form,
        valores_unitarios_chips: (form.valores_unitarios_chips || [])
          .map(item => ({
            quantidade: Number(item.quantidade || 0),
            valor_unitario: parseValorInput(item.valor_unitario)
          }))
          .filter(item => item.quantidade > 0 && item.valor_unitario > 0)
      };

      if (payload.cliente_id) {
        CAMPOS_CLIENTE_DERIVADOS.forEach((campo) => {
          payload[campo] = null;
        });
      }

      payload.valor_total = calcularTotalItensChips(form.valores_unitarios_chips);

      await onSave(payload);
    } catch (error) {
      setErro(error.message || 'Erro ao salvar venda.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{venda ? 'Editar venda' : 'Nova venda'}</div>
              <div className="modal-sub">Selecione o cliente e preencha apenas os dados especificos da venda.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="vendas-form-grid">
            {CAMPOS.map(campo => {
              if (campo.section) {
                return <div key={campo.section} className="vendas-form-section">{campo.section}</div>;
              }

              return (
                <div key={campo.name} className={`form-field ${campo.span ? 'span-2' : ''}`}>
                  <label>{campo.label}</label>
                  {campo.type === 'client' ? (
                    <ClienteVendaSelect
                      value={form[campo.name]}
                      clientes={clientes}
                      onChange={valor => atualizarCampo(campo.name, valor)}
                    />
                  ) : ['seller', 'operator', 'saleType', 'service'].includes(campo.type) ? (
                    <select
                      value={form[campo.name]}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      required={campo.required}
                    >
                      <option value="">Selecione</option>
                      {(
                        campo.type === 'seller'
                          ? vendedoras
                          : campo.type === 'operator'
                            ? operadoras
                            : campo.type === 'saleType'
                              ? tiposVenda
                              : servicos
                      ).map(item => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                  ) : campo.type === 'chips' ? (
                    <ItensChipsInput
                      value={form[campo.name]}
                      onChange={valor => atualizarCampo(campo.name, valor)}
                    />
                  ) : campo.type === 'textarea' ? (
                    <textarea
                      value={form[campo.name]}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                    />
                  ) : (
                    <input
                      type={campo.type || 'text'}
                      step={campo.step}
                      min={campo.min}
                      max={campo.max}
                      maxLength={campo.maxLength}
                      value={form[campo.name]}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      required={campo.required}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar venda'}
          </button>
        </div>
      </form>
    </div>
  );
}

function VendasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [tiposVenda, setTiposVenda] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [busca, setBusca] = useState('');
  const [vendedoraId, setVendedoraId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalVenda, setModalVenda] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [deletando, setDeletando] = useState(null);
  const usuarioLogado = getUsuarioLocal();
  const podeCriarVenda = temPermissao(usuarioLogado, 'vendas_criar');
  const podeEditarVenda = temPermissao(usuarioLogado, 'vendas_editar');
  const podeExcluirVenda = temPermissao(usuarioLogado, 'vendas_excluir');
  const podeListarClientes = temPermissao(usuarioLogado, ['clientes_ver_proprios', 'clientes_ver_todos']);

  const filtros = useMemo(() => ({ busca, vendedora_id: vendedoraId }), [busca, vendedoraId]);

  async function carregarDados() {
    setErro('');
    setCarregando(true);

    try {
      const [vendasData, clientesData, vendedorasData, operadorasData, tiposVendaData, servicosData] = await Promise.all([
        listarVendas(filtros),
        podeListarClientes ? listarClientes() : Promise.resolve([]),
        listarVendedoras(),
        listarOperadoras(),
        listarTiposVenda(),
        listarServicos()
      ]);

      setVendas(vendasData);
      setClientes(clientesData);
      setVendedoras(vendedorasData);
      setOperadoras(operadorasData);
      setTiposVenda(tiposVendaData);
      setServicos(servicosData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar vendas.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarDados();
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function abrirNovaVenda() {
    setModalVenda(null);
    setModalAberto(true);
  }

  useEffect(() => {
    function handleNovaVenda() {
      if (podeCriarVenda) {
        abrirNovaVenda();
      }
    }

    window.addEventListener('pos-venda:nova-venda', handleNovaVenda);
    return () => window.removeEventListener('pos-venda:nova-venda', handleNovaVenda);
  }, [podeCriarVenda]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (searchParams.get('nova') === '1' && podeCriarVenda) {
      abrirNovaVenda();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, podeCriarVenda]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function abrirEdicao(venda) {
    setModalVenda(venda);
    setModalAberto(true);
  }

  async function salvarVenda(dados) {
    if (modalVenda) {
      await atualizarVenda(modalVenda.id, dados);
    } else {
      await criarVenda(dados);
    }

    setModalAberto(false);
    setModalVenda(null);
    await carregarDados();
  }

  async function removerVenda(venda) {
    if (deletando !== venda.id) {
      setDeletando(venda.id);
      return;
    }

    try {
      await deletarVenda(venda.id);
      setVendas(prev => prev.filter(item => item.id !== venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao excluir venda.');
    } finally {
      setDeletando(null);
    }
  }

  return (
    <LayoutPrivado>
      {modalAberto && (
        <VendaModal
          venda={modalVenda}
          clientes={clientes}
          vendedoras={vendedoras}
          operadoras={operadoras}
          tiposVenda={tiposVenda}
          servicos={servicos}
          onClose={() => setModalAberto(false)}
          onSave={salvarVenda}
        />
      )}

      <div className="vendas-page">
        <div className="vendas-toolbar">
          <div className="search-box">
            <I.Search size={14} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone, tipo, servico, CNPJ ou cidade"
            />
          </div>

          <select value={vendedoraId} onChange={e => setVendedoraId(e.target.value)}>
            <option value="">Todas as vendedoras</option>
            {vendedoras.map(vendedora => (
              <option key={vendedora.id} value={vendedora.id}>{vendedora.nome}</option>
            ))}
          </select>

        </div>

        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          {vendas.length} vendas cadastradas
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Operadora</th>
                  <th>Tipo</th>
                  <th>Servico</th>
                  <th>Linhas</th>
                  <th>GB</th>
                  <th>Valor</th>
                  <th>Venc.</th>
                  <th>Data</th>
                  <th>Vendedora</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="11" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando vendas...
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                ) : (
                  vendas.map(venda => (
                    <tr key={venda.id}>
                      <td>
                        <div className="vendas-table-name">
                          <strong>{venda.cliente?.nome || venda.nome}</strong>
                          <span>{venda.cliente?.razao_social || venda.razao_social || venda.telefone || venda.email || '-'}</span>
                        </div>
                      </td>
                      <td><span className="tag">{venda.operadora?.nome || '-'}</span></td>
                      <td>{venda.tipoVenda?.nome || venda.produto_fechado || '-'}</td>
                      <td>{venda.servico?.nome || '-'}</td>
                      <td>{venda.quantidade_linhas || '-'}</td>
                      <td>{venda.gb || '-'}</td>
                      <td className="vendas-value">{formatarMoeda(venda.valor_total)}</td>
                      <td>{venda.dia_vencimento || '-'}</td>
                      <td>{formatarData(venda.data_venda)}</td>
                      <td><span className="tag">{venda.vendedora?.nome || '-'}</span></td>
                      <td className="row-actions">
                        {(podeEditarVenda || podeExcluirVenda) && (
                          <>
                            {podeEditarVenda && (
                              <button className="btn btn-icon btn-ghost" title="Editar" onClick={() => abrirEdicao(venda)}>
                                <I.Edit size={13} />
                              </button>
                            )}

                            {podeExcluirVenda && deletando === venda.id ? (
                              <>
                                <button
                                  className="btn btn-sm"
                                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: 11 }}
                                  onClick={() => removerVenda(venda)}
                                >
                                  Confirmar
                                </button>
                                <button className="btn btn-sm btn-ghost" onClick={() => setDeletando(null)}>
                                  Cancelar
                                </button>
                              </>
                            ) : podeExcluirVenda ? (
                              <button className="btn btn-icon btn-ghost" title="Excluir" onClick={() => removerVenda(venda)}>
                                <I.Trash size={13} />
                              </button>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default VendasPage;
