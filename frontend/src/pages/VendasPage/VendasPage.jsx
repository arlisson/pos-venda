import { useEffect, useMemo, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import {
  atualizarVenda,
  criarVenda,
  deletarVenda,
  listarVendas,
  listarVendedoras
} from '../../services/venda.service';
import { listarOperadoras } from '../../services/config.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import './VendasPage.css';

const VENDA_VAZIA = {
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

const CAMPOS = [
  { section: 'Cliente' },
  { name: 'nome', label: 'Nome', required: true },
  { name: 'vendedora_id', label: 'Vendedora', type: 'seller', required: true },
  { name: 'telefone', label: 'Telefone' },
  { name: 'fixo_ddd', label: 'Fixo com DDD' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'email_2', label: 'E-mail 2', type: 'email' },

  { section: 'Responsaveis e venda' },
  { name: 'data_venda', label: 'Data da venda', type: 'date' },
  { name: 'nome_representante_legal', label: 'Nome do representante legal' },
  { name: 'nome_fechou_venda', label: 'Nome com quem fechou a venda' },
  { name: 'cpf_representante_legal', label: 'CPF do representante legal' },
  { name: 'setor_funcao', label: 'Setor/Funcao' },
  { name: 'qc_feito_por', label: 'QC feito por' },

  { section: 'Produto e valores' },
  { name: 'operadora_id', label: 'Operadora', type: 'operator', required: true },
  { name: 'produto_fechado', label: 'Qual produto fechou' },
  { name: 'quantidade_linhas', label: 'Quantidade de linhas fechadas', type: 'number' },
  { name: 'ddd', label: 'Qual DDD' },
  { name: 'gb', label: 'GB (Gigas)' },
  { name: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', min: 1, max: 31 },
  { name: 'valor_total', label: 'Valor total fechado', type: 'number', step: '0.01' },
  { name: 'valores_unitarios_chips', label: 'Valores unitarios de cada chip', type: 'textarea', span: true },
  { name: 'numeros_portados', label: 'Numeros a serem portados', type: 'textarea', span: true },

  { section: 'Empresa e local' },
  { name: 'razao_social', label: 'Razao social' },
  { name: 'cnpj', label: 'CNPJ' },
  { name: 'endereco', label: 'Endereco' },
  { name: 'numero_endereco', label: 'Numero de endereco' },
  { name: 'complemento', label: 'Complemento' },
  { name: 'bairro', label: 'Bairro' },
  { name: 'municipio', label: 'Municipio' },
  { name: 'uf', label: 'UF', maxLength: 2 },
  { name: 'cep', label: 'CEP' },
  { name: 'ponto_referencia', label: 'Ponto de referencia', span: true },
  { name: 'tipo_local_cpf', label: 'Venda CPF: casa, hotel, condominio, shopping...', span: true },

  { section: 'Aceite, recebimento e administrador' },
  { name: 'horario_aceite_voz', label: 'Horario para aceite de voz' },
  { name: 'responsavel_recebimento', label: 'Responsavel pelo recebimento' },
  { name: 'rg_responsavel_recebimento', label: 'RG do responsavel pelo recebimento' },
  { name: 'nome_administrador', label: 'Nome Administrador' },
  { name: 'cpf_administrador', label: 'CPF Administrador' },
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

function normalizarVenda(venda) {
  return {
    ...VENDA_VAZIA,
    ...venda,
    data_venda: toInputDate(venda.data_venda),
    valor_total: venda.valor_total ?? '',
    quantidade_linhas: venda.quantidade_linhas ?? '',
    dia_vencimento: venda.dia_vencimento ?? '',
    operadora_id: venda.operadora_id ? String(venda.operadora_id) : '',
    vendedora_id: venda.vendedora_id ? String(venda.vendedora_id) : ''
  };
}

function VendaModal({ venda, vendedoras, operadoras, onClose, onSave }) {
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
      await onSave(form);
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
              <div className="modal-sub">Preenchimento manual com os campos da planilha.</div>
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
                  {campo.type === 'seller' || campo.type === 'operator' ? (
                    <select
                      value={form[campo.name]}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      required={campo.required}
                    >
                      <option value="">Selecione</option>
                      {(campo.type === 'seller' ? vendedoras : operadoras).map(item => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
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
  const [vendas, setVendas] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
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

  const filtros = useMemo(() => ({ busca, vendedora_id: vendedoraId }), [busca, vendedoraId]);

  async function carregarDados() {
    setErro('');
    setCarregando(true);

    try {
      const [vendasData, vendedorasData, operadorasData] = await Promise.all([
        listarVendas(filtros),
        listarVendedoras(),
        listarOperadoras()
      ]);

      setVendas(vendasData);
      setVendedoras(vendedorasData);
      setOperadoras(operadorasData);
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
          vendedoras={vendedoras}
          operadoras={operadoras}
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
              placeholder="Buscar por nome, telefone, produto, CNPJ ou cidade"
            />
          </div>

          <select value={vendedoraId} onChange={e => setVendedoraId(e.target.value)}>
            <option value="">Todas as vendedoras</option>
            {vendedoras.map(vendedora => (
              <option key={vendedora.id} value={vendedora.id}>{vendedora.nome}</option>
            ))}
          </select>

          {podeCriarVenda && (
            <button className="btn btn-primary" onClick={abrirNovaVenda}>
              <I.Plus size={14} /> Nova venda
            </button>
          )}
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
                  <th>Produto</th>
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
                    <td colSpan="10" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando vendas...
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                ) : (
                  vendas.map(venda => (
                    <tr key={venda.id}>
                      <td>
                        <div className="vendas-table-name">
                          <strong>{venda.nome}</strong>
                          <span>{venda.telefone || venda.email || venda.razao_social || '-'}</span>
                        </div>
                      </td>
                      <td><span className="tag">{venda.operadora?.nome || '-'}</span></td>
                      <td>{venda.produto_fechado || '-'}</td>
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
