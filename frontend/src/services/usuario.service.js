import { apiGet, apiPost } from './api';

export async function listarUsuarios() {
  return apiGet('/usuarios');
}

// Alteração aqui para usar apiGet em vez de apiPost
export async function listarPermissoes() {
  return apiGet('/permissoes');  // Alterando de apiPost para apiGet
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