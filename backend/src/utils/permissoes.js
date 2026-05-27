const Permissao = require('../models/Permissao');

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      return parsePermissoes(JSON.parse(permissoes));
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

function normalizarPermissoes(permissoes) {
  if (!permissoes) return {};

  if (typeof permissoes === 'string') {
    try {
      return normalizarPermissoes(JSON.parse(permissoes));
    } catch {
      return {};
    }
  }

  if (Array.isArray(permissoes)) {
    return permissoes.reduce((acc, permissao) => {
      acc[permissao] = true;
      return acc;
    }, {});
  }

  return permissoes;
}

function adminTemPermissaoNegada(usuario, permissao) {
  if (usuario?.role?.nome !== 'admin') {
    return false;
  }

  return normalizarPermissoes(usuario.permissoes)[permissao] === false;
}

function usuarioTemPermissaoLocal(usuario, permissao) {
  if (!usuario || !usuario.ativo) return false;

  if (usuario.role?.nome === 'admin') return !adminTemPermissaoNegada(usuario, permissao);

  const permitidas = new Set([
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ]);

  return permitidas.has(permissao);
}

async function montarMapaPermissoesEfetivas(usuario) {
  const todasPermissoes = await Permissao.query()
    .where('ativo', true)
    .orderBy('nome', 'asc');

  const permitidas = new Set([
    ...parsePermissoes(usuario?.permissoes),
    ...parsePermissoes(usuario?.role?.permissoes)
  ]);

  return todasPermissoes.reduce((acc, permissao) => {
    acc[permissao.chave] = usuario?.role?.nome === 'admin'
      ? !adminTemPermissaoNegada(usuario, permissao.chave)
      : permitidas.has(permissao.chave);
    return acc;
  }, {});
}

async function listarPermissoesEfetivas(usuario) {
  if (usuario?.role?.nome === 'admin') {
    const todasPermissoes = await Permissao.query()
      .where('ativo', true)
      .select('chave');

    return todasPermissoes
      .map(permissao => permissao.chave)
      .filter(chave => !adminTemPermissaoNegada(usuario, chave));
  }

  return parsePermissoes([
    ...parsePermissoes(usuario?.permissoes),
    ...parsePermissoes(usuario?.role?.permissoes)
  ]);
}

module.exports = {
  parsePermissoes,
  normalizarPermissoes,
  usuarioTemPermissaoLocal,
  montarMapaPermissoesEfetivas,
  listarPermissoesEfetivas
};
