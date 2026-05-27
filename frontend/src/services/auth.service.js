/**
 * Cliente de API para autenticacao, perfil local e permissoes do usuario.
 */
import { apiGet, apiPost, apiPut } from './api';

/**
 * Executa a rotina login.
 */
export async function login(email, senha) {
  const data = await apiPost('/auth/login', {
    email,
    senha
  });

  localStorage.setItem('token', data.token);
  localStorage.setItem('usuario', JSON.stringify(data.usuario));

  return data;
}

/**
 * Executa a rotina buscar perfil.
 */
export async function buscarPerfil() {
  return apiGet('/auth/me');
}

/**
 * Executa a rotina get usuario local.
 */
export function getUsuarioLocal() {
  const usuario = localStorage.getItem('usuario');

  if (!usuario) {
    return null;
  }

  return JSON.parse(usuario);
}

/**
 * Executa a rotina normalizar permissoes.
 */
function normalizarPermissoes(permissoes) {
  if (!permissoes) {
    return {};
  }

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

/**
 * Executa a rotina tem permissao.
 */
export function temPermissao(usuario, permissao) {
  if (!permissao) {
    return true;
  }

  if (Array.isArray(permissao)) {
    return permissao.some(item => temPermissao(usuario, item));
  }

  if (usuario?.role?.nome === 'admin') {
    const permissoesUsuario = normalizarPermissoes(usuario?.permissoes);
    return permissoesUsuario?.[permissao] !== false;
  }

  const permissoesUsuario = normalizarPermissoes(usuario?.permissoes);
  const permissoesRole = normalizarPermissoes(usuario?.role?.permissoes);

  return permissoesUsuario?.[permissao] === true || permissoesRole?.[permissao] === true;
}

/**
 * Executa a rotina atualizar perfil.
 */
export async function atualizarPerfil(dados) {
  const usuario = await apiPut('/auth/me', dados);

  localStorage.setItem('usuario', JSON.stringify(usuario));

  return usuario;
}

/**
 * Executa a rotina logout.
 */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}
