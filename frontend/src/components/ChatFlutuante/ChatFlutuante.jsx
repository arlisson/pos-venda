import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as I from '../Icons';
import { formatUtcDateTime } from '../../utils/datetime';
import {
  enviarMensagem,
  listarContatos,
  listarConversas,
  listarMensagens
} from '../../services/mensagem.service';
import './ChatFlutuante.css';

const INTERVALO_CONVERSAS = 10000;
const INTERVALO_MENSAGENS = 3500;

function iniciais(nome) {
  return String(nome || '?')
    .split(' ')
    .filter(Boolean)
    .map(parte => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ contato }) {
  if (contato?.foto_perfil) {
    return <span className="chat-flutuante__avatar"><img src={contato.foto_perfil} alt="" /></span>;
  }

  return <span className="chat-flutuante__avatar chat-flutuante__avatar--iniciais">{iniciais(contato?.nome)}</span>;
}

function hora(valor) {
  return formatUtcDateTime(valor, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Mantém as conversas disponíveis em qualquer tela sem substituir os modais da página.
 */
function ChatFlutuante({ usuario, naoLidas = 0 }) {
  const [aberto, setAberto] = useState(false);
  const [novaConversa, setNovaConversa] = useState(false);
  const [busca, setBusca] = useState('');
  const [contatos, setContatos] = useState([]);
  const [conversas, setConversas] = useState([]);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const listaRef = useRef(null);
  const campoRef = useRef(null);

  const carregarConversas = useCallback(async () => {
    try {
      const dados = await listarConversas();
      setConversas(Array.isArray(dados) ? dados : []);
    } catch {
      setConversas([]);
    }
  }, []);

  const carregarMensagens = useCallback(async (contatoId, rolar = false) => {
    try {
      const dados = await listarMensagens(contatoId);
      setMensagens(Array.isArray(dados) ? dados : []);
      if (rolar) requestAnimationFrame(() => {
        if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
      });
      window.dispatchEvent(new CustomEvent('pos-venda:mensagens-atualizar'));
    } catch {
      setErro('Não foi possível carregar as mensagens.');
    }
  }, []);

  useEffect(() => {
    if (!aberto) return undefined;

    // A atualização é assíncrona e o painel permanece sincronizado enquanto aberto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarConversas();
    listarContatos()
      .then(dados => setContatos(Array.isArray(dados) ? dados : []))
      .catch(() => setContatos([]));

    const timer = setInterval(carregarConversas, INTERVALO_CONVERSAS);
    return () => clearInterval(timer);
  }, [aberto, carregarConversas]);

  useEffect(() => {
    if (!aberto || !contatoSelecionado?.id) return undefined;

    // A atualização é assíncrona e o painel permanece sincronizado enquanto aberto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarMensagens(contatoSelecionado.id, true);
    const timer = setInterval(() => carregarMensagens(contatoSelecionado.id), INTERVALO_MENSAGENS);
    return () => clearInterval(timer);
  }, [aberto, contatoSelecionado?.id, carregarMensagens]);

  useEffect(() => {
    if (aberto && contatoSelecionado) campoRef.current?.focus();
  }, [aberto, contatoSelecionado]);

  const contatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    return termo ? contatos.filter(contato => contato.nome?.toLocaleLowerCase().includes(termo)) : contatos;
  }, [busca, contatos]);

  function selecionarContato(contato) {
    setErro('');
    setTexto('');
    setMensagens([]);
    setNovaConversa(false);
    setBusca('');
    setContatoSelecionado(contato);
  }

  /** Abre o seletor de usuários sem fechar o painel flutuante. */
  function abrirNovaConversa() {
    setErro('');
    setTexto('');
    setContatoSelecionado(null);
    setBusca('');
    setNovaConversa(true);
  }

  async function enviar(evento) {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || !contatoSelecionado || enviando) return;

    setEnviando(true);
    setErro('');
    setTexto('');
    try {
      await enviarMensagem(contatoSelecionado.id, conteudo);
      await Promise.all([
        carregarMensagens(contatoSelecionado.id, true),
        carregarConversas()
      ]);
    } catch (error) {
      setTexto(conteudo);
      setErro(error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  function fecharPainel() {
    setAberto(false);
    setNovaConversa(false);
    setErro('');
  }

  const painel = (
    <div className="chat-flutuante" aria-live="polite">
      {aberto ? (
        <section className="chat-flutuante__painel" role="dialog" aria-label="Mensagens rápidas">
          <header className="chat-flutuante__cabecalho">
            {contatoSelecionado ? (
              <>
                <button type="button" className="chat-flutuante__icone" onClick={() => setContatoSelecionado(null)} aria-label="Voltar para conversas">
                  <I.Return size={17} />
                </button>
                <Avatar contato={contatoSelecionado} />
                <div className="chat-flutuante__titulo">
                  <strong>{contatoSelecionado.nome}</strong>
                  <span>{contatoSelecionado.role?.nome || 'Usuário'}</span>
                </div>
                <button type="button" className="chat-flutuante__icone" onClick={abrirNovaConversa} aria-label="Nova conversa" title="Nova conversa">
                  <I.Plus size={18} />
                </button>
              </>
            ) : (
              <>
                <I.Chat size={19} />
                <div className="chat-flutuante__titulo"><strong>Mensagens</strong><span>Conversas internas</span></div>
                <button type="button" className="chat-flutuante__icone" onClick={() => setNovaConversa(valor => !valor)} aria-label="Nova conversa" title="Nova conversa">
                  {novaConversa ? <I.Close size={17} /> : <I.Plus size={18} />}
                </button>
              </>
            )}
            <button type="button" className="chat-flutuante__icone" onClick={fecharPainel} aria-label="Minimizar mensagens" title="Minimizar">
              <span aria-hidden="true">—</span>
            </button>
          </header>

          {contatoSelecionado ? (
            <>
              <div className="chat-flutuante__mensagens" ref={listaRef}>
                {mensagens.length === 0 ? (
                  <p className="chat-flutuante__vazio">Nenhuma mensagem ainda. Diga olá!</p>
                ) : mensagens.map(mensagem => {
                  const minha = Number(mensagem.remetente_id) === Number(usuario?.id);
                  return (
                    <div key={mensagem.id} className={`chat-flutuante__bolha ${minha ? 'chat-flutuante__bolha--minha' : ''}`}>
                      {mensagem.excluida ? 'Mensagem deletada' : mensagem.conteudo}
                      <small>{hora(mensagem.created_at)}</small>
                    </div>
                  );
                })}
              </div>
              <form className="chat-flutuante__form" onSubmit={enviar}>
                {erro && <p className="chat-flutuante__erro">{erro}</p>}
                <textarea
                  ref={campoRef}
                  rows="1"
                  value={texto}
                  placeholder={`Escreva para ${contatoSelecionado.nome.split(' ')[0]}...`}
                  onChange={evento => setTexto(evento.target.value)}
                  onKeyDown={evento => {
                    if (evento.key === 'Enter' && !evento.shiftKey) enviar(evento);
                  }}
                />
                <button type="submit" className="chat-flutuante__enviar" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem">
                  <I.Send size={17} />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-flutuante__lista">
              {novaConversa && (
                <div className="chat-flutuante__nova">
                  <p className="chat-flutuante__lista-titulo">Nova conversa</p>
                  <div className="chat-flutuante__busca"><I.Search size={15} /><input autoFocus value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Buscar usuário..." /></div>
                  {contatosFiltrados.map(contato => (
                    <button key={contato.id} type="button" className="chat-flutuante__contato" onClick={() => selecionarContato(contato)}>
                      <Avatar contato={contato} /><span><strong>{contato.nome}</strong><small>{contato.role?.nome || 'Usuário'}</small></span>
                    </button>
                  ))}
                  {!contatosFiltrados.length && <p className="chat-flutuante__vazio">Nenhum usuário encontrado.</p>}
                </div>
              )}
              {!novaConversa && (conversas.length ? <>
                <p className="chat-flutuante__lista-titulo">Recentes</p>
                {conversas.map(conversa => {
                const contato = conversa.contato;
                const ultima = conversa.ultima_mensagem;
                return (
                  <button key={contato.id} type="button" className="chat-flutuante__contato" onClick={() => selecionarContato(contato)}>
                    <Avatar contato={contato} />
                    <span><strong>{contato.nome}</strong><small>{ultima?.conteudo || (ultima?.anexo ? '📎 Anexo' : 'Sem mensagens')}</small></span>
                    {conversa.nao_lidas > 0 && <em>{conversa.nao_lidas > 9 ? '9+' : conversa.nao_lidas}</em>}
                  </button>
                );
                })}
              </> : <p className="chat-flutuante__vazio">Nenhuma conversa ainda. Use + para iniciar.</p>)}
            </div>
          )}
        </section>
      ) : (
        <button type="button" className="chat-flutuante__atalho" onClick={() => setAberto(true)} aria-label="Abrir mensagens">
          <I.Chat size={21} /><span>Mensagens</span>{naoLidas > 0 && <em>{naoLidas > 99 ? '99+' : naoLidas}</em>}
        </button>
      )}
    </div>
  );

  return createPortal(painel, document.body);
}

export default ChatFlutuante;
