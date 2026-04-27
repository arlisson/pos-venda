import { apiGet, apiPost, apiPut } from './api';

export async function login(email, senha) {
  const data = await apiPost('/auth/login', {
    email,
    senha
  });

  localStorage.setItem('token', data.token);
  localStorage.setItem('usuario', JSON.stringify(data.usuario));

  return data;
}

export async function buscarPerfil() {
  return apiGet('/auth/me');
}

export function getUsuarioLocal() {
  const usuario = localStorage.getItem('usuario');

  if (!usuario) {
    return null;
  }

  return JSON.parse(usuario);
}

function normalizarPermissoes(permissoes) {
  if (!permissoes) {
    return {};
  }

  if (typeof permissoes === 'string') {
    try {
      return JSON.parse(permissoes);
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

export function temPermissao(usuario, permissao) {
  if (!permissao) {
    return true;
  }

  if (usuario?.role?.nome === 'admin') {
    return true;
  }

  const permissoesUsuario = normalizarPermissoes(usuario?.permissoes);
  const permissoesRole = normalizarPermissoes(usuario?.role?.permissoes);

  return permissoesUsuario?.[permissao] === true || permissoesRole?.[permissao] === true;
}

export async function atualizarPerfil(dados) {
  const usuario = await apiPut('/auth/me', dados);

  localStorage.setItem('usuario', JSON.stringify(usuario));

  return usuario;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}
