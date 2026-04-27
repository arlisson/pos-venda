const AuditLog = require('../models/AuditLog');

const CAMPOS_SENSIVEIS = [
  'senha',
  'password',
  'token',
  'authorization',
  'jwt'
];

function limitarTexto(valor, tamanho) {
  if (valor === undefined || valor === null) {
    return null;
  }

  return String(valor).slice(0, tamanho);
}

function sanitizar(valor) {
  if (Array.isArray(valor)) {
    return valor.map(sanitizar);
  }

  if (valor && typeof valor === 'object') {
    return Object.entries(valor).reduce((acc, [chave, item]) => {
      const chaveNormalizada = chave.toLowerCase();

      if (CAMPOS_SENSIVEIS.some(campo => chaveNormalizada.includes(campo))) {
        acc[chave] = '[removido]';
        return acc;
      }

      acc[chave] = sanitizar(item);
      return acc;
    }, {});
  }

  return valor;
}

function obterUsuarioId(req, usuarioId) {
  return usuarioId || req?.usuario?.id || req?.user?.id || null;
}

function montarRegistro(req, dadosAuditoria) {
  return {
    usuario_id: obterUsuarioId(req, dadosAuditoria.usuario_id),
    acao: dadosAuditoria.acao,
    entidade: limitarTexto(dadosAuditoria.entidade, 80),
    entidade_id: limitarTexto(dadosAuditoria.entidade_id, 80),
    metodo: limitarTexto(req?.method, 10),
    rota: limitarTexto(req?.originalUrl || req?.url, 255),
    ip: limitarTexto(req?.ip, 80),
    user_agent: limitarTexto(req?.headers?.['user-agent'], 255),
    dados: JSON.stringify(sanitizar(dadosAuditoria.dados || {}))
  };
}

async function registrar(req, dadosAuditoria) {
  if (!dadosAuditoria?.acao) {
    throw new Error('A acao da auditoria e obrigatoria.');
  }

  return AuditLog.query().insert(montarRegistro(req, dadosAuditoria));
}

async function registrarSemBloquear(req, dadosAuditoria) {
  try {
    return await registrar(req, dadosAuditoria);
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
    return null;
  }
}

async function listar({ busca, limite = 160 } = {}) {
  const limiteNormalizado = Math.min(Number(limite) || 160, 500);

  const query = AuditLog.query()
    .withGraphFetched('usuario')
    .orderBy('created_at', 'desc')
    .limit(limiteNormalizado);

  if (busca) {
    const termo = `%${busca}%`;

    query.where(builder => {
      builder
        .where('acao', 'like', termo)
        .orWhere('entidade', 'like', termo)
        .orWhere('entidade_id', 'like', termo)
        .orWhere('rota', 'like', termo)
        .orWhereRaw('CAST(dados AS CHAR) LIKE ?', [termo]);
    });
  }

  return query;
}

module.exports = {
  registrar,
  registrarSemBloquear,
  listar,
  sanitizar
};
