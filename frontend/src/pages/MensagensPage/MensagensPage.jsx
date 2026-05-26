import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { getUsuarioLocal } from '../../services/auth.service';
import { formatUtcDateTime } from '../../utils/datetime';
import {
  enviarMensagem,
  listarContatos,
  listarConversas,
  listarMensagens,
  uploadAnexoMensagem,
  baixarAnexoMensagem,
  excluirMensagem
} from '../../services/mensagem.service';
import './MensagensPage.css';

const ANEXO_TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ANEXO_TAMANHO_MAX_MB = 50;

function formatarTamanho(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const INTERVALO_THREAD = 3500;
const INTERVALO_CONVERSAS = 10000;

function getInitials(nome) {
  if (!nome) return '??';
  return nome
    .split(' ')
    .map(parte => parte[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function formatarHora(valor) {
  return formatUtcDateTime(valor, { hour: '2-digit', minute: '2-digit' });
}

function formatarDataLista(valor) {
  if (!valor) return '';
  return formatUtcDateTime(valor, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Considera iguais se mesmos ids e mesmos status (recebida/lida) — evita re-render à toa.
function mesmaLista(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id
      || a[i].recebida_em !== b[i].recebida_em
      || a[i].lida_em !== b[i].lida_em
      || Boolean(a[i].excluida) !== Boolean(b[i].excluida)) {
      return false;
    }
  }
  return true;
}

// Componente que mostra anexo dentro de uma bolha. Para imagens, baixa via API
// autenticada e cria um object URL para o <img>. Para PDFs/outros, mostra um
// mini-card com botão de download.
function AnexoBolha({ anexo }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const ehImagem = anexo?.mime_type?.startsWith('image/');

  useEffect(() => {
    if (!anexo || !ehImagem) return undefined;
    let url;
    let cancelado = false;
    baixarAnexoMensagem(anexo.id)
      .then(blob => {
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [anexo, ehImagem]);

  async function baixar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const blob = await baixarAnexoMensagem(anexo.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nome_original || 'anexo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBaixando(false);
    }
  }

  if (ehImagem) {
    return (
      <div className="bolha__anexo bolha__anexo--imagem">
        {objectUrl
          ? <img src={objectUrl} alt={anexo.nome_original} onClick={baixar} />
          : <div className="bolha__anexo-loading">Carregando...</div>}
      </div>
    );
  }

  return (
    <button type="button" className="bolha__anexo bolha__anexo--arquivo" onClick={baixar} disabled={baixando}>
      <I.Document size={28} />
      <div className="bolha__anexo-info">
        <strong>{anexo.nome_original}</strong>
        <small>{formatarTamanho(anexo.tamanho_bytes)}</small>
      </div>
      <I.Download size={16} />
    </button>
  );
}

function Avatar({ contato }) {
  if (contato?.foto_perfil) {
    return (
      <span className="chat-avatar">
        <img src={contato.foto_perfil} alt={contato.nome || 'Contato'} />
      </span>
    );
  }

  return <span className="chat-avatar chat-avatar--iniciais">{getInitials(contato?.nome)}</span>;
}

function MensagensPage() {
  const usuarioLocal = useMemo(() => getUsuarioLocal(), []);
  const meuId = Number(usuarioLocal?.id);

  const [conversas, setConversas] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [buscaContato, setBuscaContato] = useState('');
  const [pendentes, setPendentes] = useState([]);
  // { file, nome, tamanho, status: 'enviando'|'pronto'|'erro', arquivo_id?, erro? }
  const [anexoPendente, setAnexoPendente] = useState(null);

  const listaRef = useRef(null);
  const fimRef = useRef(null);
  const proximaRolagemRef = useRef(true);
  const mensagensRef = useRef([]);
  const ultimoIdRef = useRef(0);
  const tempIdRef = useRef(0);
  const inputAnexoRef = useRef(null);

  const carregarConversas = useCallback(async () => {
    try {
      const dados = await listarConversas();
      setConversas(Array.isArray(dados) ? dados : []);
    } catch {
      setConversas([]);
    }
  }, []);

  const aplicarMensagens = useCallback((novas, { forcarRolagem = false } = {}) => {
    const lista = Array.isArray(novas) ? novas : [];

    // Nada mudou (mesmos ids/recebida/lida): não re-renderiza nem rola.
    if (!forcarRolagem && mesmaLista(lista, mensagensRef.current)) {
      return;
    }

    const el = listaRef.current;
    const pertoDoFim = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    const ultimoId = lista.length ? lista[lista.length - 1].id : 0;
    const chegouNova = ultimoId > ultimoIdRef.current;

    // Rola só ao enviar/selecionar, ou quando chega mensagem nova e já estava no fim.
    proximaRolagemRef.current = forcarRolagem || (chegouNova && pertoDoFim);
    ultimoIdRef.current = ultimoId;
    mensagensRef.current = lista;
    setMensagens(lista);
  }, []);

  // Carga inicial: conversas + contatos.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregarConversas();
    listarContatos()
      .then(dados => setContatos(Array.isArray(dados) ? dados : []))
      .catch(() => setContatos([]));
  }, [carregarConversas]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Atualiza a lista de conversas periodicamente.
  useEffect(() => {
    const timer = setInterval(carregarConversas, INTERVALO_CONVERSAS);
    return () => clearInterval(timer);
  }, [carregarConversas]);

  // Carrega e faz polling da conversa aberta.
  useEffect(() => {
    if (!contatoSelecionado) return undefined;

    let ativo = true;
    const contatoId = contatoSelecionado.id;

    async function carregar(forcarRolagem) {
      try {
        const idAntes = ultimoIdRef.current;
        const dados = await listarMensagens(contatoId);
        if (!ativo) return;
        aplicarMensagens(dados, { forcarRolagem });
        // Chegou mensagem nova: a thread aberta já marcou como lida no backend;
        // atualiza a lista lateral (preview/ordem/contagem) na hora.
        if (ultimoIdRef.current !== idAntes) {
          carregarConversas();
        }
        window.dispatchEvent(new CustomEvent('pos-venda:mensagens-atualizar'));
      } catch {
        if (ativo) setErro('Não foi possível carregar as mensagens.');
      }
    }

    carregar(true);
    const timer = setInterval(() => carregar(false), INTERVALO_THREAD);

    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [contatoSelecionado, aplicarMensagens, carregarConversas]);

  // Rolagem automática quando apropriado (ao fundo exato, sem o offset do padding).
  useEffect(() => {
    if (proximaRolagemRef.current) {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      proximaRolagemRef.current = false;
    }
  }, [mensagens, pendentes]);

  function selecionarContato(contato) {
    setErro('');
    setMensagens([]);
    setPendentes([]);
    setAnexoPendente(null);
    mensagensRef.current = [];
    ultimoIdRef.current = 0;
    proximaRolagemRef.current = true;
    setNovaConversaAberta(false);
    setBuscaContato('');
    setContatoSelecionado(contato);
    // Atualiza badges/contadores após abrir (a leitura é marcada no backend).
    carregarConversas();
  }

  function abrirSelecaoArquivo() {
    if (inputAnexoRef.current) inputAnexoRef.current.click();
  }

  async function handleArquivoSelecionado(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = '';
    if (!file) return;

    if (!ANEXO_TIPOS_PERMITIDOS.includes(file.type)) {
      setErro('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > ANEXO_TAMANHO_MAX_MB * 1024 * 1024) {
      setErro(`Arquivo maior que ${ANEXO_TAMANHO_MAX_MB} MB.`);
      return;
    }

    setErro('');
    setAnexoPendente({ file, nome: file.name, tamanho: file.size, status: 'enviando' });

    try {
      const resultado = await uploadAnexoMensagem(file);
      setAnexoPendente(prev => prev && prev.file === file
        ? { ...prev, status: 'pronto', arquivo_id: resultado.arquivo_id, nome_original: resultado.nome_original }
        : prev);
    } catch (e) {
      setAnexoPendente(prev => prev && prev.file === file
        ? { ...prev, status: 'erro', erro: e.message || 'Falha no upload.' }
        : prev);
    }
  }

  function removerAnexoPendente() {
    setAnexoPendente(null);
  }

  async function handleExcluirMensagem(mensagem) {
    if (!window.confirm('Excluir esta mensagem? Esta ação não pode ser desfeita.')) return;

    // Marca otimisticamente como excluída — se o backend recusar, recarrega a thread.
    const idAlvo = mensagem.id;
    const tinhaAnexo = Boolean(mensagem.anexo) || Boolean(mensagem.tinha_anexo);
    aplicarMensagens(
      mensagensRef.current.map(m => m.id === idAlvo
        ? { ...m, excluida: true, conteudo: null, anexo: null, tinha_anexo: tinhaAnexo }
        : m),
      { forcarRolagem: false }
    );

    try {
      await excluirMensagem(idAlvo);
      carregarConversas();
      window.dispatchEvent(new CustomEvent('pos-venda:mensagens-atualizar'));
    } catch (e) {
      setErro(e.message || 'Erro ao excluir mensagem.');
      if (contatoSelecionado) {
        const dados = await listarMensagens(contatoSelecionado.id).catch(() => null);
        if (dados) aplicarMensagens(dados, { forcarRolagem: false });
      }
    }
  }

  async function handleEnviar(evento) {
    evento.preventDefault();
    const conteudo = texto.trim();
    const anexoPronto = anexoPendente?.status === 'pronto' ? anexoPendente : null;
    if ((!conteudo && !anexoPronto) || !contatoSelecionado || enviando) return;
    // Se há anexo em upload ou em erro, não deixa enviar.
    if (anexoPendente && !anexoPronto) return;

    const tempId = `temp-${++tempIdRef.current}`;
    const otimista = {
      id: tempId,
      remetente_id: meuId,
      destinatario_id: contatoSelecionado.id,
      conteudo: conteudo || null,
      recebida_em: null,
      lida_em: null,
      created_at: new Date().toISOString(),
      anexo: anexoPronto ? { id: tempId, nome_original: anexoPronto.nome_original, mime_type: anexoPronto.file.type, tamanho_bytes: anexoPronto.tamanho } : null
    };

    setEnviando(true);
    setErro('');
    setTexto('');
    setAnexoPendente(null);
    proximaRolagemRef.current = true;
    setPendentes(prev => [...prev, otimista]);

    try {
      const mensagem = await enviarMensagem(
        contatoSelecionado.id,
        conteudo,
        anexoPronto ? { arquivo_id: anexoPronto.arquivo_id, nome_original: anexoPronto.nome_original } : null
      );
      setPendentes(prev => prev.filter(p => p.id !== tempId));
      aplicarMensagens([...mensagensRef.current, mensagem], { forcarRolagem: true });
      carregarConversas();
      window.dispatchEvent(new CustomEvent('pos-venda:mensagens-atualizar'));
    } catch (e) {
      setPendentes(prev => prev.filter(p => p.id !== tempId));
      setErro(e.message || 'Erro ao enviar mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  function handleTeclaInput(evento) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      handleEnviar(evento);
    }
  }

  const contatosFiltrados = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    if (!termo) return contatos;
    return contatos.filter(contato => contato.nome?.toLowerCase().includes(termo));
  }, [contatos, buscaContato]);

  // Mensagens confirmadas + bolhas otimistas ainda não confirmadas.
  const itensThread = [...mensagens, ...pendentes];

  return (
    <LayoutPrivado>
      <div className="mensagens-page">
        <div className={`mensagens-layout ${contatoSelecionado ? 'tem-conversa' : ''}`}>
          <aside className="mensagens-lista">
            <div className="mensagens-lista__topo">
              <h2>Conversas</h2>
              <button
                type="button"
                className="btn btn-icon btn-ghost"
                title="Nova conversa"
                onClick={() => setNovaConversaAberta(aberto => !aberto)}
              >
                {novaConversaAberta ? <I.Close size={16} /> : <I.Plus size={16} />}
              </button>
            </div>

            {novaConversaAberta && (
              <div className="mensagens-novaconversa">
                <div className="mensagens-busca">
                  <I.Search size={14} />
                  <input
                    type="text"
                    placeholder="Buscar usuário..."
                    value={buscaContato}
                    onChange={evento => setBuscaContato(evento.target.value)}
                    autoFocus
                  />
                </div>
                <div className="mensagens-contatos">
                  {contatosFiltrados.length === 0 ? (
                    <div className="mensagens-vazio-sm">Nenhum usuário encontrado.</div>
                  ) : (
                    contatosFiltrados.map(contato => (
                      <button
                        key={contato.id}
                        type="button"
                        className="mensagens-contato"
                        onClick={() => selecionarContato(contato)}
                      >
                        <Avatar contato={contato} />
                        <span className="mensagens-contato__info">
                          <strong>{contato.nome}</strong>
                          <small>{contato.role?.nome || 'Usuário'}</small>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="mensagens-conversas">
              {conversas.length === 0 ? (
                <div className="mensagens-vazio-sm">
                  Nenhuma conversa ainda. Clique em <strong>+</strong> para iniciar.
                </div>
              ) : (
                conversas.map(conversa => (
                  <button
                    key={conversa.contato.id}
                    type="button"
                    className={`mensagens-conversa ${contatoSelecionado?.id === conversa.contato.id ? 'is-active' : ''}`}
                    onClick={() => selecionarContato(conversa.contato)}
                  >
                    <Avatar contato={conversa.contato} />
                    <span className="mensagens-conversa__corpo">
                      <span className="mensagens-conversa__linha">
                        <strong>{conversa.contato.nome}</strong>
                        <em>{formatarDataLista(conversa.ultima_mensagem?.created_at)}</em>
                      </span>
                      <span className="mensagens-conversa__preview">
                        {(() => {
                          const ultima = conversa.ultima_mensagem;
                          if (!ultima) return 'Sem mensagens';
                          const prefixo = ultima.remetente_id === meuId ? 'Você: ' : '';
                          if (ultima.excluida) {
                            return `${prefixo}${ultima.tinha_anexo ? 'Arquivo deletado' : 'Mensagem deletada'}`;
                          }
                          if (ultima.conteudo) return `${prefixo}${ultima.conteudo}`;
                          if (ultima.anexo) return `${prefixo}📎 ${ultima.anexo.nome_original}`;
                          return `${prefixo}—`;
                        })()}
                      </span>
                    </span>
                    {conversa.nao_lidas > 0 && conversa.contato.id !== contatoSelecionado?.id && (
                      <span className="mensagens-conversa__badge">{conversa.nao_lidas > 9 ? '9+' : conversa.nao_lidas}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="mensagens-thread">
            {!contatoSelecionado ? (
              <div className="mensagens-vazio">
                <I.Chat size={40} />
                <p>Selecione uma conversa ou inicie uma nova.</p>
              </div>
            ) : (
              <>
                <header className="thread-topo">
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost thread-voltar"
                    aria-label="Voltar"
                    onClick={() => setContatoSelecionado(null)}
                  >
                    <I.Return size={16} />
                  </button>
                  <Avatar contato={contatoSelecionado} />
                  <div className="thread-topo__info">
                    <strong>{contatoSelecionado.nome}</strong>
                    <small>{contatoSelecionado.role?.nome || 'Usuário'}</small>
                  </div>
                </header>

                <div className="thread-mensagens" ref={listaRef}>
                  {itensThread.length === 0 ? (
                    <div className="mensagens-vazio-sm thread-inicio">
                      Nenhuma mensagem ainda. Diga olá!
                    </div>
                  ) : (
                    itensThread.map(mensagem => {
                      const minha = mensagem.remetente_id === meuId;
                      const status = mensagem.lida_em ? 'lida' : (mensagem.recebida_em ? 'recebida' : 'enviada');
                      const statusLabel = status === 'lida' ? 'Lido' : status === 'recebida' ? 'Recebido' : 'Enviado';
                      const ehTemp = typeof mensagem.id === 'string' && mensagem.id.startsWith('temp-');
                      const excluida = Boolean(mensagem.excluida);
                      const placeholder = excluida
                        ? (mensagem.tinha_anexo ? 'Arquivo deletado' : 'Mensagem deletada')
                        : null;
                      return (
                        <div key={mensagem.id} className={`bolha ${minha ? 'bolha--minha' : 'bolha--dele'} ${excluida ? 'bolha--excluida' : ''}`}>
                          {minha && !ehTemp && !excluida && (
                            <button
                              type="button"
                              className="bolha__excluir"
                              onClick={() => handleExcluirMensagem(mensagem)}
                              title="Excluir mensagem"
                              aria-label="Excluir mensagem"
                            >
                              <I.Trash size={12} />
                            </button>
                          )}
                          {excluida ? (
                            <span className="bolha__texto bolha__texto--excluida">
                              <I.TrashSend size={12} /> {placeholder}
                            </span>
                          ) : (
                            <>
                              {mensagem.anexo && !ehTemp && <AnexoBolha anexo={mensagem.anexo} />}
                              {mensagem.anexo && ehTemp && (
                                <div className="bolha__anexo bolha__anexo--arquivo">
                                  <I.Document size={28} />
                                  <div className="bolha__anexo-info">
                                    <strong>{mensagem.anexo.nome_original}</strong>
                                    <small>Enviando...</small>
                                  </div>
                                </div>
                              )}
                              {mensagem.conteudo && <span className="bolha__texto">{mensagem.conteudo}</span>}
                            </>
                          )}
                          <span className="bolha__meta">
                            {formatarHora(mensagem.created_at)}
                            {minha && !excluida && (
                              <span className={`bolha__check is-${status}`} title={statusLabel}>
                                {status === 'enviada' ? '✓' : '✓✓'}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={fimRef} />
                </div>

                {erro && <div className="thread-erro">{erro}</div>}

                {anexoPendente && (
                  <div className={`thread-anexo-preview is-${anexoPendente.status}`}>
                    <I.Document size={20} />
                    <div className="thread-anexo-preview__info">
                      <strong>{anexoPendente.nome}</strong>
                      <small>
                        {anexoPendente.status === 'enviando' && 'Enviando...'}
                        {anexoPendente.status === 'pronto' && formatarTamanho(anexoPendente.tamanho)}
                        {anexoPendente.status === 'erro' && (anexoPendente.erro || 'Erro')}
                      </small>
                    </div>
                    <button type="button" className="btn btn-icon btn-ghost" onClick={removerAnexoPendente} aria-label="Remover anexo">
                      <I.Close size={14} />
                    </button>
                  </div>
                )}

                <form className="thread-input" onSubmit={handleEnviar}>
                  <input
                    ref={inputAnexoRef}
                    type="file"
                    accept={ANEXO_TIPOS_PERMITIDOS.join(',')}
                    onChange={handleArquivoSelecionado}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost thread-anexar"
                    onClick={abrirSelecaoArquivo}
                    disabled={enviando || Boolean(anexoPendente)}
                    aria-label="Anexar arquivo"
                    title="Anexar arquivo (PDF, JPG, PNG, WEBP)"
                  >
                    <I.Paperclip size={18} />
                  </button>
                  <textarea
                    value={texto}
                    onChange={evento => setTexto(evento.target.value)}
                    onKeyDown={handleTeclaInput}
                    placeholder="Escreva uma mensagem..."
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary thread-enviar"
                    disabled={enviando
                      || (!texto.trim() && anexoPendente?.status !== 'pronto')
                      || (anexoPendente && anexoPendente.status !== 'pronto')}
                    aria-label="Enviar"
                  >
                    <I.Send size={16} />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default MensagensPage;
