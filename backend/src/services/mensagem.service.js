const Mensagem = require('../models/Mensagem');
const Usuario = require('../models/Usuario');
const db = require('../database/connection');

function erroHttp(mensagem, statusCode) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
}

// Objection serializa um Date como ISO ("...T...Z") que o MySQL grava como
// "0000-00-00". Passamos um texto UTC "YYYY-MM-DD HH:MM:SS" para gravar correto.
function agoraUtc() {
  const data = new Date();
  const pad = valor => String(valor).padStart(2, '0');
  return `${data.getUTCFullYear()}-${pad(data.getUTCMonth() + 1)}-${pad(data.getUTCDate())} `
    + `${pad(data.getUTCHours())}:${pad(data.getUTCMinutes())}:${pad(data.getUTCSeconds())}`;
}

const PERMISSAO_CHAT = 'chat_usar';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      if (Array.isArray(parsed)) return parsed;
      return Object.entries(parsed)
        .filter(([, permitido]) => permitido === true)
        .map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

function temPermissaoChat(usuario) {
  if (!usuario || !usuario.estaAtivo?.()) return false;
  if (usuario.role?.nome === 'admin') return true;

  return [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ].includes(PERMISSAO_CHAT);
}

function formatarContato(usuario) {
  if (!usuario) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    foto_perfil: usuario.foto_perfil || null,
    role: usuario.role ? { nome: usuario.role.nome } : null
  };
}

function formatarMensagem(mensagem) {
  return {
    id: mensagem.id,
    remetente_id: mensagem.remetente_id,
    destinatario_id: mensagem.destinatario_id,
    conteudo: mensagem.conteudo,
    recebida_em: mensagem.recebida_em,
    lida_em: mensagem.lida_em,
    created_at: mensagem.created_at
  };
}

async function listarContatos(usuarioId) {
  const usuarios = await Usuario.query()
    .withGraphFetched('role')
    .where('ativo', true)
    .whereNot('id', Number(usuarioId))
    .orderBy('nome', 'asc');

  // Só usuários que podem usar o chat podem ser contatados.
  return usuarios.filter(temPermissaoChat).map(formatarContato);
}

async function contarNaoLidas(usuarioId) {
  const me = Number(usuarioId);

  const linhas = await db('mensagens')
    .where('destinatario_id', me)
    .whereNull('lida_em')
    .groupBy('remetente_id')
    .select('remetente_id')
    .count('* as total');

  const por_contato = {};
  let total = 0;

  for (const linha of linhas) {
    const quantidade = Number(linha.total);
    por_contato[Number(linha.remetente_id)] = quantidade;
    total += quantidade;
  }

  return { total, por_contato };
}

async function listarConversas(usuarioId) {
  const me = Number(usuarioId);

  const contatos = await db('mensagens')
    .where('remetente_id', me)
    .orWhere('destinatario_id', me)
    .distinct(db.raw(
      'CASE WHEN remetente_id = ? THEN destinatario_id ELSE remetente_id END AS contato_id',
      [me]
    ));

  const contatoIds = contatos
    .map(linha => Number(linha.contato_id))
    .filter(id => id && id !== me);

  if (contatoIds.length === 0) {
    return [];
  }

  const { por_contato: naoLidasPorContato } = await contarNaoLidas(me);

  const usuarios = await Usuario.query()
    .withGraphFetched('role')
    .whereIn('id', contatoIds);
  const usuariosPorId = new Map(usuarios.map(usuario => [Number(usuario.id), usuario]));

  const conversas = [];

  for (const contatoId of contatoIds) {
    const usuario = usuariosPorId.get(contatoId);
    if (!usuario) continue;

    const ultima = await Mensagem.query()
      .where(builder => {
        builder
          .where({ remetente_id: me, destinatario_id: contatoId })
          .orWhere({ remetente_id: contatoId, destinatario_id: me });
      })
      .orderBy('id', 'desc')
      .first();

    conversas.push({
      contato: formatarContato(usuario),
      ultima_mensagem: ultima ? formatarMensagem(ultima) : null,
      nao_lidas: naoLidasPorContato[contatoId] || 0
    });
  }

  conversas.sort((a, b) => {
    const dataA = a.ultima_mensagem?.created_at || '';
    const dataB = b.ultima_mensagem?.created_at || '';
    return String(dataB).localeCompare(String(dataA));
  });

  return conversas;
}

async function marcarConversaLida(usuarioId, contatoId) {
  const me = Number(usuarioId);
  const contato = Number(contatoId);

  await Mensagem.query()
    .where('destinatario_id', me)
    .where('remetente_id', contato)
    .whereNull('lida_em')
    .patch({ lida_em: agoraUtc() });

  return true;
}

async function listarMensagens(usuarioId, contatoId, { desde, limit = 50 } = {}) {
  const me = Number(usuarioId);
  const contato = Number(contatoId);

  if (!contato || Number.isNaN(contato)) {
    throw erroHttp('Contato inválido.', 400);
  }

  // Marca como lidas as mensagens recebidas deste contato.
  await marcarConversaLida(me, contato);

  const query = Mensagem.query().where(builder => {
    builder
      .where({ remetente_id: me, destinatario_id: contato })
      .orWhere({ remetente_id: contato, destinatario_id: me });
  });

  let mensagens;

  if (desde) {
    mensagens = await query.where('id', '>', Number(desde)).orderBy('id', 'asc');
  } else {
    const registros = await query
      .orderBy('id', 'desc')
      .limit(Math.min(Number(limit) || 50, 100));
    mensagens = registros.reverse();
  }

  return mensagens.map(formatarMensagem);
}

async function enviarMensagem(remetenteId, destinatarioId, conteudo) {
  const remetente = Number(remetenteId);
  const destinatario = Number(destinatarioId);
  const texto = typeof conteudo === 'string' ? conteudo.trim() : '';

  if (!destinatario || Number.isNaN(destinatario)) {
    throw erroHttp('Destinatário inválido.', 400);
  }

  if (destinatario === remetente) {
    throw erroHttp('Não é possível enviar mensagem para si mesmo.', 400);
  }

  if (!texto) {
    throw erroHttp('A mensagem não pode estar vazia.', 400);
  }

  const usuarioDestino = await Usuario.query()
    .findById(destinatario)
    .withGraphFetched('role');

  if (!usuarioDestino || !usuarioDestino.estaAtivo()) {
    throw erroHttp('Destinatário não encontrado ou inativo.', 404);
  }

  if (!temPermissaoChat(usuarioDestino)) {
    throw erroHttp('Este usuário não pode usar o chat.', 403);
  }

  const agora = agoraUtc();
  const mensagem = await Mensagem.query().insertAndFetch({
    remetente_id: remetente,
    destinatario_id: destinatario,
    conteudo: texto,
    // "Recebido" = mensagem salva no servidor (independe do destinatário estar online).
    recebida_em: agora,
    created_at: agora,
    updated_at: agora
  });

  return formatarMensagem(mensagem);
}

module.exports = {
  listarContatos,
  listarConversas,
  listarMensagens,
  enviarMensagem,
  contarNaoLidas,
  marcarConversaLida
};
