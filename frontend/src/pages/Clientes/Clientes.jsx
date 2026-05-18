import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from '../../utils/useDebounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as I from '../../components/Icons';
import Paginacao from '../../components/Paginacao/Paginacao';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import ClienteModal from './ClienteModal';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atribuirDonoCliente,
  excluirCliente,
  importarBaseAnterior,
  limparClientesBaseAnterior,
  listarClientes,
  previewImportacaoBaseAnterior
} from '../../services/cliente.service';
import { listarNotasEntidade } from '../../services/nota.service';
import { listarEtapasFunil, listarOperadoras } from '../../services/config.service';
import { contarVendasConcluidasPorCliente, listarVendedoras } from '../../services/venda.service';
import { formatUtcDateTime, getUtcDateTimeTimestamp } from '../../utils/datetime';
import SelectFiltro from '../../components/SelectFiltro/SelectFiltro';
import './Clientes.css';

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

function formatarMoeda(valor) {
  if (valor === undefined || valor === null || valor === '') return '-';

  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarDataHoraNota(valor) {
  return formatUtcDateTime(valor, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getRetornoNotaStatus(cliente) {
  const resumo = cliente.notas_resumo || {};

  if (Number(resumo.notas_com_retorno_total || 0) > 0) {
    return {
      className: 'success',
      title: `Retorno marcado para ${formatarDataHoraNota(resumo.proximo_retorno_agendado_para) || 'este cliente'}`
    };
  }

  if (cliente.aviso_fidelidade?.dias_restantes < 0) {
    return {
      className: 'danger',
      title: 'Fidelidade vencida sem retorno marcado'
    };
  }

  return {
    className: 'muted',
    title: 'Sem retorno marcado'
  };
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
              <strong>Este cliente será enviado para a lixeira.</strong>
              <span>Ele ficará disponível para restauração e será permanentemente deletado daqui a 1 mês.</span>
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

function ConfirmarLimpezaBaseModal({ aberto, limpando, onClose, onConfirm }) {
  if (!aberto) return null;

  return (
    <div className="modal-overlay" onClick={event => !limpando && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Limpar clientes da base?</div>
              <div className="modal-sub">Clientes marcados como base anterior serao apagados.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={limpando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="trash-warning">
            <I.AlertTriangle size={20} />
            <div>
              <strong>Esta acao apaga permanentemente os clientes da base anterior.</strong>
              <span>As vendas vinculadas deixarao de apontar para esses clientes.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={limpando}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={limpando}>
            {limpando ? 'Limpando...' : 'Limpar clientes da base'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotasClienteReadOnlyModal({ cliente, notas, carregando, erro, onClose }) {
  if (!cliente) return null;

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal cliente-notes-readonly-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Notas do cliente</div>
              <div className="modal-sub">{cliente.nome || cliente.razao_social || `Cliente #${cliente.id}`}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {erro && <div className="alert-error">{erro}</div>}

          {carregando ? (
            <div className="notes-loading">Carregando notas...</div>
          ) : notas.length === 0 ? (
            <div className="notes-empty notes-empty--compact">
              <I.Note size={20} />
              <strong>Nenhuma nota ainda.</strong>
              <span>Este cliente ainda não tem anotações.</span>
            </div>
          ) : (
            <div className="cliente-notes-readonly-list">
              {notas.map(nota => (
                <article key={nota.id} className="cliente-note-readonly-card">
                  <div className="cliente-note-readonly-card__head">
                    <strong>{nota.titulo || 'Sem titulo'}</strong>
                    <span>{formatarDataHoraNota(nota.updated_at)}</span>
                  </div>
                  <p>{nota.conteudo || '-'}</p>
                  {nota.retorno_agendado_para && (
                    <div className="cliente-note-readonly-card__return">
                      <I.Calendar size={13} /> Retorno em {formatarDataHoraNota(nota.retorno_agendado_para)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

const CAMPOS_IMPORTACAO_BASE = [
  { name: 'cnpj', label: 'CNPJ', required: true },
  { name: 'nome', label: 'Nome' },
  { name: 'razao_social', label: 'Razao social' },
  { name: 'responsavel_nome', label: 'Responsavel' },
  { name: 'email', label: 'E-mail' },
  { name: 'whatsapp', label: 'WhatsApp' },
  { name: 'fixo', label: 'Fixo' },
  { name: 'quantidade_chips', label: 'Quantidade de chips' },
  { name: 'valor_pago', label: 'Valor pago' },
  { name: 'operadora_atual', label: 'Operadora atual' }
];

function ImportarBaseAnteriorModal({ onClose, onImported }) {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapeamento, setMapeamento] = useState({});
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const colunas = preview?.colunas || [];
  const podeImportar = Boolean(arquivo && preview && mapeamento.cnpj && !carregando);

  async function carregarPreview(file) {
    setArquivo(file || null);
    setPreview(null);
    setResultado(null);
    setMapeamento({});
    setErro('');

    if (!file) return;

    setCarregando(true);
    try {
      const data = await previewImportacaoBaseAnterior(file);
      setPreview(data);
      setMapeamento(data.sugestoes || {});
    } catch (error) {
      setErro(error.message || 'Erro ao ler planilha.');
    } finally {
      setCarregando(false);
    }
  }

  async function executarImportacao(event) {
    event.preventDefault();
    if (!podeImportar) return;

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const data = await importarBaseAnterior(arquivo, mapeamento);
      setResultado(data);
      await onImported(data);
    } catch (error) {
      setErro(error.message || 'Erro ao importar planilha.');
    } finally {
      setCarregando(false);
    }
  }

  function atualizarMapeamento(campo, coluna) {
    setMapeamento(prev => ({ ...prev, [campo]: coluna }));
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && !carregando && onClose()}>
      <form className="modal cliente-import-modal" onSubmit={executarImportacao}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Importar base anterior</div>
              <div className="modal-sub">Selecione o Excel e relacione cada coluna aos campos do cliente.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose} disabled={carregando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label>Arquivo .xlsx</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={event => carregarPreview(event.target.files?.[0])}
              disabled={carregando}
            />
          </div>

          {preview && (
            <>
              <div className="cliente-import-summary">
                <span>Aba: <strong>{preview.aba}</strong></span>
                <span>Linhas: <strong>{preview.total_linhas}</strong></span>
                <span>Colunas: <strong>{colunas.length}</strong></span>
              </div>

              <div className="cliente-import-map">
                <div className="cliente-import-map__head">
                  <span>Campo do cliente</span>
                  <span>Coluna do Excel</span>
                  <span>Amostras</span>
                </div>
                {CAMPOS_IMPORTACAO_BASE.map(campo => {
                  const colunaSelecionada = mapeamento[campo.name] || '';
                  const amostras = (preview.amostras || [])
                    .map(item => item.dados?.[colunaSelecionada])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(' | ');

                  return (
                    <div className="cliente-import-map__row" key={campo.name}>
                      <label>
                        {campo.label}
                        {campo.required && <span className="required-mark">*</span>}
                      </label>
                      <select
                        value={colunaSelecionada}
                        onChange={event => atualizarMapeamento(campo.name, event.target.value)}
                        required={campo.required}
                        disabled={carregando}
                      >
                        <option value="">Não importar</option>
                        {colunas.map(coluna => (
                          <option key={`${campo.name}:${coluna.index}`} value={coluna.nome}>{coluna.nome}</option>
                        ))}
                      </select>
                      <span title={amostras}>{amostras || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {resultado && (
            <div className="cliente-import-result">
              <span>Linhas lidas: <strong>{resultado.linhas_lidas}</strong></span>
              <span>CNPJs unicos: <strong>{resultado.cnpjs_unicos}</strong></span>
              <span>Criados: <strong>{resultado.criados}</strong></span>
              <span>Atualizados: <strong>{resultado.atualizados}</strong></span>
              <span>Ignorados: <strong>{resultado.linhas_ignoradas}</strong></span>
              {resultado.operadoras_nao_encontradas?.length > 0 && (
                <span>Operadoras nao encontradas: <strong>{resultado.operadoras_nao_encontradas.join(', ')}</strong></span>
              )}
              {resultado.erros?.length > 0 && (
                <span>Erros: <strong>{resultado.erros.slice(0, 3).map(item => `linha ${item.row_index}`).join(', ')}</strong></span>
              )}
            </div>
          )}

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={carregando}>Fechar</button>
          <button type="submit" className="btn btn-primary" disabled={!podeImportar}>
            {carregando ? 'Processando...' : 'Importar clientes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Clientes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const usuario = getUsuarioLocal();
  const clienteIdParam = searchParams.get('cliente_id') || '';
  const fidelidadeParam = searchParams.get('fidelidade') || '';
  const retornoParam = searchParams.get('retorno') || '';
  const novoClienteParam = searchParams.get('novo') === '1';
  const highlightClienteId = searchParams.get('highlight') || clienteIdParam;

  const podeCriar = temPermissao(usuario, 'clientes_criar');
  const podeEditar = temPermissao(usuario, 'clientes_editar');
  const podeExcluir = temPermissao(usuario, 'clientes_excluir');
  const isAdmin = usuario?.role?.nome === 'admin';
  const podeAtribuirVendedora = isAdmin || temPermissao(usuario, 'clientes_atribuir_vendedora');

  const [clientes, setClientes] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [vendasConcluidasContagem, setVendasConcluidasContagem] = useState({});
  const [etapasFunil, setEtapasFunil] = useState([]);
  const [busca, setBusca] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [responsavelTipo, setResponsavelTipo] = useState('');
  const [fidelidade, setFidelidade] = useState(fidelidadeParam);
  const [retorno, setRetorno] = useState(retornoParam);
  const [baseAnterior, setBaseAnterior] = useState('');
  const [chipsMin, setChipsMin] = useState('');
  const [chipsMax, setChipsMax] = useState('');
  const [clienteIdFiltro, setClienteIdFiltro] = useState(clienteIdParam);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [clienteModal, setClienteModal] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteCadastroDraft, setClienteCadastroDraft] = useState(null);
  const [importModalAberto, setImportModalAberto] = useState(false);
  const [limparBaseModalAberto, setLimparBaseModalAberto] = useState(false);
  const [clienteParaLixeira, setClienteParaLixeira] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [limpandoBase, setLimpandoBase] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [clienteNotasModal, setClienteNotasModal] = useState(null);
  const [notasCliente, setNotasCliente] = useState([]);
  const [carregandoNotasCliente, setCarregandoNotasCliente] = useState(false);
  const [erroNotasCliente, setErroNotasCliente] = useState('');
  const [atribuindoDonoId, setAtribuindoDonoId] = useState(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [totalClientes, setTotalClientes] = useState(0);

  const buscaDebounced = useDebounce(busca, 300);

  const filtros = useMemo(() => ({
    busca: buscaDebounced,
    operadora_atual_id: operadoraId,
    responsavel_tipo: responsavelTipo,
    fidelidade,
    retorno,
    base_anterior_sistema: baseAnterior,
    chips_min: chipsMin,
    chips_max: chipsMax,
    cliente_id: clienteIdFiltro
  }), [buscaDebounced, operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax, clienteIdFiltro]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = useMemo(() => (
    [operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax]
      .filter(v => v !== '').length
  ), [operadoraId, responsavelTipo, fidelidade, retorno, baseAnterior, chipsMin, chipsMax]);

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

  async function carregarDadosEstaticos() {
    try {
      const [operadorasData, contagemData, etapasData, vendedorasData] = await Promise.all([
        listarOperadoras(),
        contarVendasConcluidasPorCliente(),
        listarEtapasFunil(),
        podeAtribuirVendedora ? listarVendedoras() : Promise.resolve([])
      ]);
      setOperadoras(operadorasData);
      setVendasConcluidasContagem(contagemData || {});
      setEtapasFunil(etapasData || []);
      setVendedoras(vendedorasData || []);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar dados.');
    }
  }

  async function carregarClientes(proximosFiltros = filtros, pagina = paginaAtual, porPagina = itensPorPagina) {
    setErro('');
    setCarregando(true);

    try {
      const dados = await listarClientes({ ...proximosFiltros, page: pagina, per_page: porPagina });
      setClientes(dados.data);
      setTotalClientes(dados.total);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarDadosEstaticos();
  }, []);

  useEffect(() => {
    setClienteIdFiltro(clienteIdParam);
  }, [clienteIdParam]);

  useEffect(() => {
    setFidelidade(fidelidadeParam);
  }, [fidelidadeParam]);

  useEffect(() => {
    setRetorno(retornoParam);
  }, [retornoParam]);

  useEffect(() => {
    if (!novoClienteParam) return;

    if (podeCriar) {
      setClienteModal(null);
      setModalAberto(true);
    } else {
      setErro('Você não tem permissão para cadastrar clientes.');
    }

    const proximosParams = new URLSearchParams(searchParams);
    proximosParams.delete('novo');
    setSearchParams(proximosParams, { replace: true });
  }, [novoClienteParam, podeCriar, searchParams, setSearchParams]);

  useEffect(() => {
    setPaginaAtual(1);
    carregarClientes(filtros, 1);
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    function handleNotasAtualizar({ detail }) {
      const { clienteId, notas } = detail;
      setClientes(prev => prev.map(c => {
        if (Number(c.id) !== Number(clienteId)) return c;
        const comRetorno = notas.filter(n => n.retorno_agendado_para);
        const agendadas = comRetorno
          .map(n => n.retorno_agendado_para)
          .sort((a, b) => getUtcDateTimeTimestamp(a, Number.MAX_SAFE_INTEGER) - getUtcDateTimeTimestamp(b, Number.MAX_SAFE_INTEGER));
        const agora = Date.now();
        const vencidas = agendadas.filter(d => getUtcDateTimeTimestamp(d, Number.MAX_SAFE_INTEGER) <= agora);
        return {
          ...c,
          notas_resumo: {
            notas_total: notas.length,
            notas_com_retorno_total: comRetorno.length,
            notas_retorno_vencido_total: vencidas.length,
            proximo_retorno_agendado_para: agendadas[0] || null,
            proximo_retorno_vencido_para: vencidas[0] || null
          }
        };
      }));
    }

    window.addEventListener('pos-venda:notas-cliente-atualizar', handleNotasAtualizar);
    return () => window.removeEventListener('pos-venda:notas-cliente-atualizar', handleNotasAtualizar);
  }, []);

  const clientesComAviso = useMemo(() => (
    clientes.filter(cliente => cliente.aviso_fidelidade?.deve_avisar).length
  ), [clientes]);

  const vendasConcluidasPorCliente = useMemo(() => {
    const mapa = new Map();
    Object.entries(vendasConcluidasContagem).forEach(([id, total]) => {
      mapa.set(`cliente:${id}`, total);
    });
    return mapa;
  }, [vendasConcluidasContagem]);

  async function handleBuscar(event) {
    event.preventDefault();
    await carregarClientes(filtros);
  }

  function limparFiltros() {
    setBusca('');
    setOperadoraId('');
    setResponsavelTipo('');
    setFidelidade('');
    setRetorno('');
    setBaseAnterior('');
    setChipsMin('');
    setChipsMax('');
    setClienteIdFiltro('');
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

  async function salvarCliente(clienteSalvo) {
    setErro('');
    const editando = Boolean(clienteModal);
    setModalAberto(false);
    setClienteModal(null);
    if (!editando) {
      setClienteCadastroDraft(null);
    }
    await carregarClientes(filtros);
    setSucesso(editando ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
  }

  async function finalizarImportacaoBaseAnterior(resultado) {
    await carregarClientes(filtros);
    setSucesso(`Importacao concluida: ${resultado.criados || 0} criado(s) e ${resultado.atualizados || 0} atualizado(s).`);
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

  async function confirmarLimpezaBaseAnterior() {
    setLimpandoBase(true);
    setErro('');

    try {
      const resultado = await limparClientesBaseAnterior();
      setLimparBaseModalAberto(false);
      await carregarClientes(filtros);
      setSucesso(`${resultado.excluidos || 0} cliente(s) da base anterior apagado(s).`);
    } catch (error) {
      setErro(error.message || 'Erro ao limpar clientes da base anterior.');
    } finally {
      setLimpandoBase(false);
    }
  }

  async function alterarDonoCliente(cliente, usuarioId) {
    if (!podeAtribuirVendedora || !usuarioId || Number(usuarioId) === Number(cliente.criado_por_id)) return;

    setAtribuindoDonoId(cliente.id);
    setErro('');

    try {
      const atualizado = await atribuirDonoCliente(cliente.id, usuarioId);
      setClientes(prev => prev.map(item => (
        Number(item.id) === Number(cliente.id) ? atualizado : item
      )));
      setSucesso('Cliente atribuido com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao atribuir cliente.');
    } finally {
      setAtribuindoDonoId(null);
    }
  }

  async function abrirNotasCliente(cliente) {
    setClienteNotasModal(cliente);
    setNotasCliente([]);
    setErroNotasCliente('');
    setCarregandoNotasCliente(true);

    try {
      const notas = await listarNotasEntidade('cliente', cliente.id);
      setNotasCliente(Array.isArray(notas) ? notas : []);
    } catch (error) {
      setErroNotasCliente(error.message || 'Erro ao carregar notas.');
    } finally {
      setCarregandoNotasCliente(false);
    }
  }

  return (
    <LayoutPrivado>
      {modalAberto && (
        <ClienteModal
          cliente={clienteModal}
          operadoras={operadoras}
          initialDraft={clienteCadastroDraft}
          onClose={() => setModalAberto(false)}
          onSave={salvarCliente}
          onDraftChange={setClienteCadastroDraft}
        />
      )}

      {importModalAberto && (
        <ImportarBaseAnteriorModal
          onClose={() => setImportModalAberto(false)}
          onImported={finalizarImportacaoBaseAnterior}
        />
      )}

      <ConfirmarLixeiraModal
        cliente={clienteParaLixeira}
        excluindo={excluindo}
        onClose={() => setClienteParaLixeira(null)}
        onConfirm={confirmarExclusaoCliente}
      />

      <ConfirmarLimpezaBaseModal
        aberto={limparBaseModalAberto}
        limpando={limpandoBase}
        onClose={() => setLimparBaseModalAberto(false)}
        onConfirm={confirmarLimpezaBaseAnterior}
      />

      <NotasClienteReadOnlyModal
        cliente={clienteNotasModal}
        notas={notasCliente}
        carregando={carregandoNotasCliente}
        erro={erroNotasCliente}
        onClose={() => {
          setClienteNotasModal(null);
          setNotasCliente([]);
          setErroNotasCliente('');
        }}
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
                <SelectFiltro
                  value={operadoraId}
                  onChange={setOperadoraId}
                  placeholder="Todas"
                  options={operadoras.map(op => ({ value: String(op.id), label: op.nome }))}
                />
              </div>
              <div className="filter-field">
                <label>Responsavel</label>
                <SelectFiltro
                  value={responsavelTipo}
                  onChange={setResponsavelTipo}
                  placeholder="Todos"
                  options={[
                    { value: 'rl', label: 'RL' },
                    { value: 'adm', label: 'ADM' },
                  ]}
                />
              </div>
              <div className="filter-field">
                <label>Fidelidade</label>
                <SelectFiltro
                  value={fidelidade}
                  onChange={setFidelidade}
                  placeholder="Todas"
                  options={[
                    { value: 'ativa', label: 'Ativa' },
                    { value: 'alerta', label: 'Com alerta' },
                    { value: 'vencida', label: 'Vencida' },
                    { value: 'sem', label: 'Sem fidelidade' },
                  ]}
                />
              </div>
              <div className="filter-field">
                <label>Base anterior</label>
                <SelectFiltro
                  value={baseAnterior}
                  onChange={setBaseAnterior}
                  placeholder="Todos"
                  options={[
                    { value: 'true', label: 'Somente base anterior' },
                    { value: 'false', label: 'Sem marcador' },
                  ]}
                />
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
        <div className="clientes-toolbar">
          <div className="clientes-toolbar__meta">
            {totalClientes} clientes cadastrados
            {clientesComAviso > 0 ? ` - ${clientesComAviso} aviso(s) de fidelidade` : ''}
            {filtrosAtivos > 0 ? ` - ${filtrosAtivos} filtro(s) ativo(s)` : ''}
          </div>

          <div className="clientes-toolbar__actions">
            <form className="clientes-search" onSubmit={handleBuscar}>
              <I.Search size={14} />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder="Buscar por nome, CNPJ sem pontos, e-mail..."
              />
            </form>

            <button className="btn" type="button" onClick={() => setFiltrosAbertos(true)}>
              <I.Filter size={14} /> Filtros
              {filtrosPopupAtivos > 0 && <span className="filtros-count">{filtrosPopupAtivos}</span>}
            </button>

            {podeCriar && (
              <>
                <button className="btn" type="button" onClick={() => setImportModalAberto(true)}>
                  <I.TableSheet size={14} /> Importar base
                </button>
                {/* {isAdmin && (
                  <button className="btn btn-danger" type="button" onClick={() => setLimparBaseModalAberto(true)}>
                    <I.Trash size={14} /> Apagar base anterior
                  </button>
                )} */}
                <button className="btn btn-primary" type="button" onClick={abrirNovoCliente}>
                  <I.Plus size={14} /> Novo cliente
                </button>
              </>
            )}

            {podeExcluir && (
              <button className="btn btn-danger" type="button" onClick={() => navigate('/clientes/lixeira')}>
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
                  <th>Valor pago</th>
                  <th>Chips</th>
                  <th>Fidelidade</th>
                  <th>Notas</th>
                  {podeExcluir && <th>Excluir</th>}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeExcluir ? 10 : 9} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={podeExcluir ? 10 : 9} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map(cliente => {
                    const contato = formatarContato(cliente);
                    const fidelidade = formatarFidelidade(cliente.aviso_fidelidade);
                    const retornoNota = getRetornoNotaStatus(cliente);

                    return (
                      <tr
                        key={cliente.id}
                        className={[
                          podeEditar ? 'clickable-row is-tappable' : '',
                          String(cliente.id) === String(highlightClienteId) ? 'cliente-row-highlight' : '',
                          fidelidade === 'vencida' && cliente.aviso_fidelidade?.dias_restantes < 0 ? 'cliente-row-fidelity-expired' : ''
                        ].filter(Boolean).join(' ')}
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
                        <td data-label="Cliente" className="m-primary">
                          <div className="cliente-primary">
                            <div className="cliente-primary__title">
                              <strong>{cliente.nome}</strong>
                            </div>
                            <div className="cliente-primary__badges">
                              {cliente.base_anterior_sistema ? (
                                <span className="tag clientes-base-tag">Base anterior</span>
                              ) : null}
                              {(() => {
                                const n = vendasConcluidasPorCliente.get(`cliente:${cliente.id}`) || 0;
                                if (!n) return null;
                                return (
                                  <span className="clientes-concluidas-badge">
                                    <I.Check size={11} />
                                    {n} {n === 1 ? 'venda concluída' : 'vendas concluídas'}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="cliente-primary__document">{cliente.razao_social || 'Sem razão social'} - {cliente.cnpj || 'Sem CNPJ'}</span>
                            <details className="cliente-mobile-drawer" onClick={event => event.stopPropagation()}>
                              <summary>Ver detalhes</summary>
                              <dl>
                                <dt>Responsavel</dt>
                                <dd>{cliente.responsavel_tipo === 'adm' ? 'ADM' : 'RL'} {cliente.responsavel_nome || '-'}</dd>
                                <dt>Contato</dt>
                                <dd>{cliente.email || '-'} / {contato.whatsapp || contato.fixo || '-'}</dd>
                                <dt>Operadora</dt>
                                <dd>{cliente.operadoraAtual?.nome || '-'}</dd>
                                <dt>Registrado por</dt>
                                <dd>
                                  {podeAtribuirVendedora ? (
                                    <div className="cliente-owner-select-wrap" onClick={e => e.stopPropagation()}>
                                      <SelectFiltro
                                        value={cliente.criado_por_id ? String(cliente.criado_por_id) : ''}
                                        disabled={atribuindoDonoId === cliente.id}
                                        placeholder="Sem registro"
                                        options={vendedoras.map(v => ({ value: String(v.id), label: v.nome }))}
                                        onChange={val => alterarDonoCliente(cliente, val)}
                                      />
                                    </div>
                                  ) : (
                                    cliente.criador?.nome || 'Sem registro'
                                  )}
                                </dd>
                                <dt>Valor pago</dt>
                                <dd>{formatarMoeda(cliente.valor_pago)}</dd>
                                <dt>Chips</dt>
                                <dd>{cliente.quantidade_chips ?? '-'}</dd>
                                <dt>Notas</dt>
                                <dd>
                                  <button
                                    type="button"
                                    className={`cliente-note-status-btn ${retornoNota.className}`}
                                    title={retornoNota.title}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      abrirNotasCliente(cliente);
                                    }}
                                  >
                                    <I.Note size={13} />
                                    Abrir nota
                                  </button>
                                </dd>
                                {podeExcluir && (
                                  <>
                                    <dt>Ações</dt>
                                    <dd>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-ghost btn-danger-icon cliente-mobile-delete-btn"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setClienteParaLixeira(cliente);
                                        }}
                                      >
                                        <I.Trash size={13} />
                                        Excluir
                                      </button>
                                    </dd>
                                  </>
                                )}
                              </dl>
                            </details>
                          </div>
                        </td>
                        <td data-label="Responsavel" data-mobile-hidden="true">
                          <span className="tag">{cliente.responsavel_tipo === 'adm' ? 'ADM' : 'RL'}</span>{' '}
                          {cliente.responsavel_nome || '-'}
                        </td>
                        <td data-label="Contato" className="m-secondary">
                          <div className="cliente-contact">
                            <span>{cliente.email || '-'}</span>
                            <span>{contato.whatsapp || contato.fixo || '-'}</span>
                          </div>
                        </td>
                        <td data-label="Operadora" data-mobile-hidden="true">{cliente.operadoraAtual?.nome || '-'}</td>
                        <td data-label="Registrado por" data-mobile-hidden="true">
                          {podeAtribuirVendedora ? (
                            <div className="cliente-owner-select-wrap" onClick={e => e.stopPropagation()} title="Atribuir cliente a uma vendedora">
                              <SelectFiltro
                                value={cliente.criado_por_id ? String(cliente.criado_por_id) : ''}
                                disabled={atribuindoDonoId === cliente.id}
                                placeholder="Sem registro"
                                options={vendedoras.map(v => ({ value: String(v.id), label: v.nome }))}
                                onChange={val => alterarDonoCliente(cliente, val)}
                              />
                            </div>
                          ) : (
                            <span className="tag">{cliente.criador?.nome || 'Sem registro'}</span>
                          )}
                        </td>
                        <td data-label="Valor pago" data-mobile-hidden="true">{formatarMoeda(cliente.valor_pago)}</td>
                        <td data-label="Chips" data-mobile-hidden="true">{cliente.quantidade_chips ?? '-'}</td>
                        <td data-label="Fidelidade" className="m-meta">
                          <span className={`pill ${fidelidade.className}`}>
                            <span className="pill-dot"></span>
                            {fidelidade.label}
                          </span>
                        </td>
                        <td data-label="Notas">
                          <button
                            type="button"
                            className={`cliente-note-status-btn ${retornoNota.className}`}
                            title={retornoNota.title}
                            onClick={(event) => {
                              event.stopPropagation();
                              abrirNotasCliente(cliente);
                            }}
                          >
                            <I.Note size={13} />
                            Nota
                          </button>
                        </td>
                        {podeExcluir && (
                          <td data-label="Excluir">
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
            <Paginacao
              total={totalClientes}
              paginaAtual={paginaAtual}
              itensPorPagina={itensPorPagina}
              onPagina={pagina => { setPaginaAtual(pagina); carregarClientes(filtros, pagina); }}
              onItensPorPagina={n => { setItensPorPagina(n); setPaginaAtual(1); carregarClientes(filtros, 1, n); }}
            />
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default Clientes;
