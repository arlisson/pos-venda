import { apiGet, apiPost, apiPut, apiDelete } from './api';

export async function listarUsuarios() {
  return apiGet('/usuarios');
}

export async function buscarUsuarioPorId(id) {
  return apiGet(`/usuarios/${id}`);
}

export async function listarPermissoes() {
  return apiGet('/permissoes');
}

export async function criarUsuario({ nome, email, senha, role_id, permissoes }) {
  return apiPost('/usuarios', {
    nome,
    email,
    senha,
    role_id,
    permissoes
  });
}

export async function atualizarUsuario(id, dados) {
  return apiPut(`/usuarios/${id}`, dados);
}

export async function deletarUsuario(id) {
  return apiDelete(`/usuarios/${id}`);
}