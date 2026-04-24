import { apiGet, apiPost } from './api';

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

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}