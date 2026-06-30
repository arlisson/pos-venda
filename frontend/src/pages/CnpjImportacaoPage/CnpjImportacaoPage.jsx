import { useMemo, useRef, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  adicionarClientesCnpj,
  consultarPlanilhaCnpjStream,
  exportarResultadoCnpj,
  previewPlanilhaCnpj
} from '../../services/cnpj.service';
import '../Clientes/Clientes.css';
import './CnpjImportacaoPage.css';

const COLUNAS_TABELA = [
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'razao_social', label: 'Razao social' },
  { key: 'nome_fantasia', label: 'Nome fantasia' },
  { key: 'situacao_cadastral', label: 'Situacao' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'telefone_open_cnpj', label: 'Tel. Open CNPJ' },
  { key: 'telefone_cnpjws', label: 'Tel. CNPJ.ws' },
  { key: 'telefone_minha_receita', label: 'Tel. Minha Receita' },
  { key: 'telefone_google_places', label: 'Tel. Google' },
  { key: 'google_status', label: 'Google status' },
  { key: 'google_detalhe', label: 'Google detalhe' },
  { key: 'telefone_fonte', label: 'Fonte telefone' },
  { key: 'telefone_confianca', label: 'Conf. telefone' },
  { key: 'cep', label: 'CEP' },
  { key: 'endereco', label: 'Endereco' },
  { key: 'numero', label: 'Numero' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'municipio', label: 'Municipio' },
  { key: 'uf', label: 'UF' },
  { key: 'fontes', label: 'Fontes' }
];

function valorCelula(linha, coluna) {
  const valor = linha[coluna.key];
  if (Array.isArray(valor)) return valor.join(', ');
  return valor || '-';
}

function linhaPodeAdicionar(linha) {
  return linha.status === 'encontrado' && !linha.adicionado;
}

function esperarCancelavel(ms, signal) {
  if (!ms || ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Busca cancelada.', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Renderiza pagina de importacao e consulta de CNPJ por planilha.
 */
function CnpjImportacaoPage() {
  const usuario = getUsuarioLocal();
  const podeCriarCliente = temPermissao(usuario, 'clientes_criar');
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [colunaCnpj, setColunaCnpj] = useState('');
  const [usarGoogleFallback, setUsarGoogleFallback] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [progresso, setProgresso] = useState(null);
  const cancelControllerRef = useRef(null);

  const colunas = preview?.colunas || [];
  const linhas = useMemo(() => resultado?.linhas || [], [resultado]);
  const linhasAdicionaveis = useMemo(() => linhas.filter(linhaPodeAdicionar), [linhas]);
  const totalEncontrados = linhas.filter(linha => linha.status === 'encontrado').length;
  const totalErros = linhas.filter(linha => linha.status === 'erro').length;
  const podeBuscar = Boolean(arquivo && colunaCnpj && !carregando);
  const totalCnpjs = Number(resultado?.total_cnpjs || 0);
  const totalConsultadosAcumulado = linhas.length;

  async function carregarPreview(file) {
    setArquivo(file || null);
    setPreview(null);
    setResultado(null);
    setColunaCnpj('');
    setErro('');
    setSucesso('');
    setProgresso(null);
    cancelControllerRef.current?.abort();
    cancelControllerRef.current = null;

    if (!file) return;

    setCarregando(true);
    try {
      const data = await previewPlanilhaCnpj(file);
      setPreview(data);
      setColunaCnpj(data.sugestoes?.cnpj || '');
    } catch (error) {
      setErro(error.message || 'Erro ao ler planilha.');
    } finally {
      setCarregando(false);
    }
  }

  async function consultarLoteStream(inicio, acumular, requisicoesBase, signal) {
    let fimLote = null;

      await consultarPlanilhaCnpjStream(arquivo, {
        cnpj: colunaCnpj,
        inicio,
        limite: preview?.limite_linhas,
        google: usarGoogleFallback ? 'sem_telefone' : 'nao'
      }, evento => {
        if (evento.tipo === 'inicio') {
          setResultado(prev => {
            const linhasAnteriores = acumular ? (prev?.linhas || []) : [];
            const requisicoesAnteriores = acumular ? Number(prev?.requisicoes_externas || 0) : 0;
            return {
              ...evento,
              total_consultados: linhasAnteriores.length,
              requisicoes_externas: requisicoesAnteriores,
              linhas: linhasAnteriores
            };
          });
          setProgresso({
            atual: 0,
            total_lote: evento.total_lote || 0,
            cnpj: '',
            inicio: evento.inicio || 0,
            total_cnpjs: evento.total_cnpjs || 0
          });
          return;
        }

        if (evento.tipo === 'progresso') {
          setProgresso(prev => ({
            ...(prev || {}),
            atual: evento.atual || 0,
            total_lote: evento.total_lote || prev?.total_lote || 0,
            cnpj: evento.cnpj || ''
          }));
          return;
        }

        if (evento.tipo === 'linha') {
          setResultado(prev => {
            const linhasAtuais = prev?.linhas || [];
            const jaExiste = linhasAtuais.some(linha => linha.cnpj_digitos === evento.linha?.cnpj_digitos);
            const proximasLinhas = jaExiste ? linhasAtuais : [...linhasAtuais, evento.linha];
            return {
              ...(prev || {}),
              requisicoes_externas: requisicoesBase + Number(evento.requisicoes_externas || 0),
              total_consultados: proximasLinhas.length,
              linhas: proximasLinhas
            };
          });
          return;
        }

        if (evento.tipo === 'fim') {
          fimLote = evento;
          setResultado(prev => ({
            ...(prev || {}),
            ...evento,
            requisicoes_externas: requisicoesBase + Number(evento.requisicoes_externas || 0),
            linhas: prev?.linhas || []
          }));

          const fim = inicio + Number(evento.total_consultados || 0);
          setSucesso(`Lote consultado: ${inicio + 1}-${fim} de ${evento.total_cnpjs || fim} CNPJ(s).`);
          setProgresso(null);
          return;
        }

        if (evento.tipo === 'erro') {
          throw new Error(evento.message || 'Erro ao consultar CNPJs.');
        }
      }, { signal });

    return fimLote;
  }

  async function buscarTodosLotes() {
    if (!podeBuscar) return;

    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;

    setCarregando(true);
    setErro('');
    setSucesso('');
    setProgresso(null);
    setResultado(null);

    let inicio = 0;
    let acumular = false;
    let requisicoesBase = 0;

    try {
      while (!controller.signal.aborted) {
        const fim = await consultarLoteStream(inicio, acumular, requisicoesBase, controller.signal);

        if (!fim) break;

        requisicoesBase += Number(fim.requisicoes_externas || 0);

        if (!fim.tem_proximo_lote || fim.proximo_inicio === null || fim.proximo_inicio === undefined) {
          setSucesso(`Busca concluida: ${fim.total_cnpjs || inicio + Number(fim.total_consultados || 0)} CNPJ(s) processado(s).`);
          break;
        }

        setProgresso({
          atual: fim.total_consultados || 0,
          total_lote: fim.total_consultados || 0,
          cnpj: '',
          mensagem: 'Aguardando intervalo para o proximo lote...'
        });
        await esperarCancelavel(Number(fim.intervalo_ms || 0), controller.signal);
        inicio = fim.proximo_inicio;
        acumular = true;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setSucesso('Busca cancelada. Os resultados ja encontrados foram mantidos.');
      } else {
        setErro(error.message || 'Erro ao consultar CNPJs.');
      }
    } finally {
      if (cancelControllerRef.current === controller) {
        cancelControllerRef.current = null;
      }
      setProgresso(null);
      setCarregando(false);
    }
  }

  function cancelarBusca() {
    cancelControllerRef.current?.abort();
  }

  async function buscarEmpresas(event) {
    event.preventDefault();
    await buscarTodosLotes();
  }

  function marcarClientesCriados(resposta) {
    const criados = new Set((resposta.clientes || []).map(item => item.cnpj_digitos));
    if (criados.size === 0) return;

    setResultado(prev => ({
      ...prev,
      linhas: (prev?.linhas || []).map(linha => (
        criados.has(linha.cnpj_digitos)
          ? { ...linha, adicionado: true, cliente_id: [...(resposta.clientes || [])].find(item => item.cnpj_digitos === linha.cnpj_digitos)?.id || linha.cliente_id }
          : linha
      ))
    }));
  }

  async function adicionarLinhas(linhasSelecionadas) {
    if (!podeCriarCliente || linhasSelecionadas.length === 0 || adicionando) return;

    setAdicionando(true);
    setErro('');
    setSucesso('');

    try {
      const data = await adicionarClientesCnpj(linhasSelecionadas);
      marcarClientesCriados(data);
      const partes = [`${data.criados || 0} cliente(s) criado(s)`];
      if (data.ignorados) partes.push(`${data.ignorados} ignorado(s)`);
      if (data.erros?.length) partes.push(`${data.erros.length} erro(s)`);
      setSucesso(partes.join(', ') + '.');
      if (data.erros?.length) {
        setErro(data.erros.slice(0, 3).map(item => `${item.cnpj}: ${item.message}`).join(' | '));
      }
    } catch (error) {
      setErro(error.message || 'Erro ao adicionar clientes.');
    } finally {
      setAdicionando(false);
    }
  }

  async function exportarResultado() {
    if (linhas.length === 0 || exportando) return;

    setExportando(true);
    setErro('');
    setSucesso('');

    try {
      await exportarResultadoCnpj(linhas, preview?.arquivo || 'consulta-cnpj');
      setSucesso('Resultado exportado em Excel.');
    } catch (error) {
      setErro(error.message || 'Erro ao exportar resultado.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <LayoutPrivado>
      <div className="cnpj-import-page">
        <form className="panel cnpj-import-panel" onSubmit={buscarEmpresas}>
          <div className="panel-header">
            <div>
              <h2>Consulta de empresas por CNPJ</h2>
              <p>Importe uma planilha, escolha a coluna de CNPJ e consulte Open CNPJ, CNPJ.ws e Minha Receita.</p>
            </div>
            {resultado && podeCriarCliente && (
              <div className="cnpj-import-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={exportarResultado}
                  disabled={exportando || linhas.length === 0}
                >
                  <I.Download size={14} />
                  {exportando ? 'Exportando...' : 'Baixar Excel'}
                </button>
                {carregando && (
                  <button
                    type="button"
                    className="btn"
                    onClick={cancelarBusca}
                  >
                    <I.Close size={14} />
                    Cancelar busca
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => adicionarLinhas(linhasAdicionaveis)}
                  disabled={carregando || adicionando || linhasAdicionaveis.length === 0}
                >
                  <I.Plus size={14} />
                  {adicionando ? 'Adicionando...' : 'Adicionar todos exibidos'}
                </button>
              </div>
            )}
          </div>

          <div className="cnpj-import-controls">
            <div className="form-field">
              <label>Arquivo .xlsx</label>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={event => carregarPreview(event.target.files?.[0])}
                disabled={carregando || adicionando}
              />
            </div>

            <div className="form-field">
              <label>Coluna do CNPJ</label>
              <select
                value={colunaCnpj}
                onChange={event => setColunaCnpj(event.target.value)}
                disabled={!preview || carregando || adicionando}
                required
              >
                <option value="">Selecione</option>
                {colunas.map(coluna => (
                  <option key={`${coluna.nome}:${coluna.index}`} value={coluna.nome}>{coluna.nome}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Google Places</label>
              <select
                value={usarGoogleFallback ? 'sem_telefone' : 'nao'}
                onChange={event => setUsarGoogleFallback(event.target.value === 'sem_telefone')}
                disabled={carregando || adicionando}
              >
                <option value="sem_telefone">So se faltar telefone</option>
                <option value="nao">Nao usar Google</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={!podeBuscar || adicionando}>
              <I.Search size={14} />
              {carregando ? 'Buscando...' : 'Buscar tudo'}
            </button>
            {carregando && (
              <button type="button" className="btn" onClick={cancelarBusca}>
                <I.Close size={14} />
                Cancelar
              </button>
            )}
          </div>

          {preview && (
            <div className="cliente-import-summary">
              <span>Aba: <strong>{preview.aba}</strong></span>
              <span>Linhas: <strong>{preview.total_linhas}</strong></span>
              <span>Colunas: <strong>{colunas.length}</strong></span>
              <span>Limite por busca: <strong>{preview.limite_linhas}</strong></span>
            </div>
          )}

          {progresso && (
            <div className="cnpj-import-progress">
              <div className="cnpj-import-progress__bar">
                <span
                  style={{
                    width: `${progresso.total_lote ? Math.min(100, Math.round((progresso.atual / progresso.total_lote) * 100)) : 0}%`
                  }}
                />
              </div>
              <strong>{progresso.atual || 0}/{progresso.total_lote || 0}</strong>
              <span>{progresso.mensagem || (progresso.cnpj ? `Consultando ${progresso.cnpj}` : 'Preparando consulta...')}</span>
            </div>
          )}

          {preview && (
            <div className="cnpj-import-samples">
              {(preview.amostras || []).map(amostra => (
                <span key={amostra.row_index}>
                  Linha {amostra.row_index}: <strong>{amostra.dados?.[colunaCnpj] || '-'}</strong>
                </span>
              ))}
            </div>
          )}

          {erro && <div className="alert-error">{erro}</div>}
          {sucesso && <div className="alert-success">{sucesso}</div>}
        </form>

        {resultado && (
          <div className="panel cnpj-import-results">
            <div className="panel-header">
              <div>
                <h2>Dados retornados</h2>
                <p>{totalEncontrados} encontrado(s), {totalErros} com erro, {resultado.requisicoes_externas || 0} consulta(s) externa(s).</p>
                {totalCnpjs > 0 && (
                  <p>{totalConsultadosAcumulado} de {totalCnpjs} CNPJ(s) consultado(s) nesta planilha.</p>
                )}
              </div>
              {carregando && (
                <div className="cnpj-import-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={exportarResultado}
                    disabled={exportando || linhas.length === 0}
                  >
                    <I.Download size={14} />
                    {exportando ? 'Exportando...' : 'Baixar Excel'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={cancelarBusca}
                  >
                    <I.Close size={14} />
                    Cancelar busca
                  </button>
                </div>
              )}
              {!carregando && linhas.length > 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={exportarResultado}
                  disabled={exportando}
                >
                  <I.Download size={14} />
                  {exportando ? 'Exportando...' : 'Baixar Excel'}
                </button>
              )}
            </div>

            <div className="list-table cnpj-import-table">
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      {COLUNAS_TABELA.map(coluna => <th key={coluna.key}>{coluna.label}</th>)}
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(linha => (
                      <tr key={`${linha.row_index}:${linha.cnpj_digitos}`}>
                        <td>
                          <span className={`tag ${linha.status === 'erro' ? 'tag-danger' : linha.cache ? 'tag-info' : 'tag-success'}`}>
                            {linha.status === 'erro' ? 'Erro' : linha.cache ? 'Cache' : 'OK'}
                          </span>
                          {linha.message && <small>{linha.message}</small>}
                        </td>
                        {COLUNAS_TABELA.map(coluna => (
                          <td key={coluna.key} title={valorCelula(linha, coluna)}>
                            {valorCelula(linha, coluna)}
                          </td>
                        ))}
                        <td>
                          {linha.adicionado ? (
                            <span className="tag tag-success">Adicionado</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => adicionarLinhas([linha])}
                              disabled={!podeCriarCliente || !linhaPodeAdicionar(linha) || adicionando}
                              title={podeCriarCliente ? 'Adicionar cliente' : 'Sem permissao para cadastrar clientes'}
                            >
                              <I.Plus size={13} />
                              Adicionar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default CnpjImportacaoPage;
