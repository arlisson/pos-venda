import { useEffect, useMemo, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import Paginacao from '../../components/Paginacao/Paginacao';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import { sanitizarCnpj, validarDigitosCnpj } from '../../services/cnpj.service';
import { buscarClienteAntigo, listarHistoricoClientesAntigos } from '../../services/cliente-antigo.service';
import '../Clientes/Clientes.css';
import './ClientesAntigosPage.css';

/**
 * Formata um CNPJ (parcial ou completo) para exibicao 00.000.000/0000-00.
 */
function formatarCnpj(valor) {
  const d = sanitizarCnpj(valor);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Formata uma data (YYYY-MM-DD ou ISO) para DD/MM/AAAA. Retorna '-' se vazio.
 */
function formatarData(valor) {
  if (!valor) return '-';
  const texto = String(valor);
  const match = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
}

/**
 * Formata timestamp para "DD/MM/AA às HH:MM".
 */
function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = valor instanceof Date ? valor : new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return String(valor);
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const aa = String(data.getFullYear()).slice(2);
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aa} às ${hh}:${min}`;
}

/**
 * Pagina de busca de clientes antigos (vendas fora da fidelidade) e historico de buscas.
 */
function ClientesAntigosPage() {
  const usuario = getUsuarioLocal();
  const podeBuscar = temPermissao(usuario, 'clientes_antigos_buscar');
  const podeHistorico = temPermissao(usuario, 'clientes_antigos_ver_historico');

  const abas = useMemo(() => [
    { id: 'buscar', label: 'Buscar', permitido: podeBuscar },
    { id: 'historico', label: 'Histórico de buscas', permitido: podeHistorico }
  ].filter(item => item.permitido), [podeBuscar, podeHistorico]);

  const [aba, setAba] = useState(abas[0]?.id || '');

  // --- Busca ---
  const [termoInput, setTermoInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resposta, setResposta] = useState(null);
  const [paginaBusca, setPaginaBusca] = useState(1);
  const [erro, setErro] = useState('');

  const cnpjDigitos = sanitizarCnpj(termoInput);
  const cnpjValido = cnpjDigitos.length === 14 && validarDigitosCnpj(cnpjDigitos);
  const termoBuscavel = cnpjValido || termoInput.trim().length >= 3;

  /**
   * Mascara de CNPJ so quando o texto ainda pode ser um documento; nomes de
   * empresa passam crus.
   */
  function alterarTermo(valor) {
    const texto = String(valor || '');
    const apenasDocumento = texto.replace(/[0-9.\-/\s]/g, '') === '';
    setTermoInput(apenasDocumento && sanitizarCnpj(texto).length > 11 ? formatarCnpj(texto) : texto);
  }

  async function executarBusca(pagina) {
    setBuscando(true);
    setErro('');

    try {
      const data = await buscarClienteAntigo(termoInput, { page: pagina, per_page: 20 });
      setResposta(data);
      setPaginaBusca(pagina);
    } catch (error) {
      setResposta(null);
      setErro(error.message || 'Erro ao buscar cliente antigo.');
    } finally {
      setBuscando(false);
    }
  }

  async function buscar(event) {
    event.preventDefault();
    if (!termoBuscavel || buscando) return;
    await executarBusca(1);
  }

  // --- Historico ---
  const [historico, setHistorico] = useState([]);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState('');

  useEffect(() => {
    if (aba !== 'historico' || !podeHistorico) return;

    let ativo = true;
    const timer = setTimeout(async () => {
      setCarregandoHistorico(true);
      setErroHistorico('');
      try {
        const data = await listarHistoricoClientesAntigos({
          page: pagina,
          per_page: porPagina,
          busca: buscaHistorico
        });
        if (!ativo) return;
        setHistorico(data?.data || []);
        setTotalHistorico(Number(data?.total || 0));
      } catch (error) {
        if (ativo) setErroHistorico(error.message || 'Erro ao carregar histórico.');
      } finally {
        if (ativo) setCarregandoHistorico(false);
      }
    }, 300);

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [aba, podeHistorico, pagina, porPagina, buscaHistorico]);

  function trocarAba(id) {
    setAba(id);
    setErro('');
    setErroHistorico('');
  }

  function alterarBuscaHistorico(valor) {
    const texto = String(valor || '');
    const digitos = sanitizarCnpj(texto);
    const apenasDocumento = digitos && texto.replace(/[0-9.\-/\s]/g, '') === '';

    setPagina(1);
    setBuscaHistorico(apenasDocumento ? formatarCnpj(digitos) : valor);
  }

  return (
    <LayoutPrivado>
      <div className="clientes-antigos-page">
        {abas.length === 0 ? (
          <div className="empty">Você não tem permissão para acessar esta ferramenta.</div>
        ) : (
          <div className="panel">
            <div className="panel-header">
              <div className="config-tabs">
                {abas.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`filter-chip ${aba === item.id ? 'active' : ''}`}
                    onClick={() => trocarAba(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-body">
              {aba === 'buscar' && (
                <div className="clientes-antigos-buscar">
                  <form className="clientes-antigos-form" onSubmit={buscar}>
                    <div className="form-field">
                      <label>CNPJ, CPF ou razão social</label>
                      <input
                        type="text"
                        maxLength={255}
                        value={termoInput}
                        onChange={event => alterarTermo(event.target.value)}
                        placeholder="00.000.000/0000-00 ou nome da empresa"
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!termoBuscavel || buscando}>
                      <I.Search size={14} />
                      {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                  </form>

                  {erro && <div className="alert-error">{erro}</div>}

                  {resposta && !erro && resposta.tipo === 'documento' && (
                    resposta.encontrado ? (
                      <div className="clientes-antigos-resultado">
                        <div className="clientes-antigos-card">
                          <div className="clientes-antigos-card__linha">
                            <span className="clientes-antigos-card__label">
                              {resposta.venda.documento_tipo === 'cpf' ? 'CPF' : 'CNPJ'}
                            </span>
                            <strong>{resposta.venda.cnpj || '-'}</strong>
                          </div>
                          <div className="clientes-antigos-card__linha">
                            <span className="clientes-antigos-card__label">Razão social</span>
                            <strong>{resposta.venda.razao_social || '-'}</strong>
                          </div>
                          <div className="clientes-antigos-card__linha">
                            <span className="clientes-antigos-card__label">Nome fantasia</span>
                            <strong>{resposta.venda.nome_fantasia || '-'}</strong>
                          </div>
                          <div className="clientes-antigos-card__linha">
                            <span className="clientes-antigos-card__label">Data da venda</span>
                            <strong>{formatarData(resposta.venda.data_venda)}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty">Nenhuma venda antiga encontrada para este documento.</div>
                    )
                  )}

                  {resposta && !erro && resposta.tipo === 'nome' && (
                    resposta.encontrado ? (
                      <div className="clientes-antigos-resultado">
                        <div className="list-table">
                          <div className="scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Razão social</th>
                                  <th>Nome fantasia</th>
                                  <th>Documento</th>
                                  <th>Data da venda</th>
                                </tr>
                              </thead>
                              <tbody>
                                {resposta.resultados.map((item, indice) => (
                                  <tr key={`${item.cnpj || item.razao_social}:${indice}`}>
                                    <td>{item.razao_social || '-'}</td>
                                    <td>{item.nome_fantasia || '-'}</td>
                                    <td>{item.cnpj || <em>sem documento</em>}</td>
                                    <td>{formatarData(item.data_venda)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <Paginacao
                          total={resposta.total}
                          paginaAtual={paginaBusca}
                          itensPorPagina={resposta.per_page}
                          onPagina={executarBusca}
                        />
                      </div>
                    ) : (
                      <div className="empty">Nenhuma venda antiga encontrada para esta razão social.</div>
                    )
                  )}
                </div>
              )}

              {aba === 'historico' && (
                <div className="clientes-antigos-historico">
                  <div className="search-box">
                    <I.Search size={14} />
                    <input
                      value={buscaHistorico}
                      onChange={event => alterarBuscaHistorico(event.target.value)}
                      placeholder="Filtrar por usuário ou termo buscado"
                    />
                  </div>

                  {erroHistorico && <div className="alert-error">{erroHistorico}</div>}

                  <div className="list-table">
                    <div className="scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Usuário</th>
                            <th>Termo buscado</th>
                            <th>Data e hora</th>
                            <th>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {carregandoHistorico ? (
                            <tr><td colSpan={4}>Carregando...</td></tr>
                          ) : historico.length === 0 ? (
                            <tr><td colSpan={4}>Nenhuma busca registrada.</td></tr>
                          ) : historico.map(item => (
                            <tr key={item.id}>
                              <td>{item.usuario_nome || '—'}</td>
                              <td>{item.termo || item.cnpj_formatado || formatarCnpj(item.cnpj_digitos)}</td>
                              <td>{formatarDataHora(item.buscado_em)}</td>
                              <td>
                                <span className={`tag ${item.encontrou ? 'tag-success' : 'tag-danger'}`}>
                                  {item.encontrou ? 'Encontrado' : 'Não encontrado'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Paginacao
                    total={totalHistorico}
                    paginaAtual={pagina}
                    itensPorPagina={porPagina}
                    onPagina={setPagina}
                    onItensPorPagina={valor => { setPagina(1); setPorPagina(valor); }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default ClientesAntigosPage;
