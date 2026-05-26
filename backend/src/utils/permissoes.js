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

function usuarioTemPermissaoLocal(usuario, permissao) {
  if (!usuario || !usuario.ativo) return false;

  if (usuario.role?.nome === 'admin') return true;

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
      ? true
      : permitidas.has(permissao.chave);
    return acc;
  }, {});
}

async function listarPermissoesEfetivas(usuario) {
  if (usuario?.role?.nome === 'admin') {
    const todasPermissoes = await Permissao.query()
      .where('ativo', true)
      .select('chave');

    return todasPermissoes.map(permissao => permissao.chave);
  }

  return parsePermissoes([
    ...parsePermissoes(usuario?.permissoes),
    ...parsePermissoes(usuario?.role?.permissoes)
  ]);
}

module.exports = {
  parsePermissoes,
  usuarioTemPermissaoLocal,
  montarMapaPermissoesEfetivas,
  listarPermissoesEfetivas
};
