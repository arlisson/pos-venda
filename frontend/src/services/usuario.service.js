/**
 * Cliente de API para usuarios, permissoes e manutencao de cadastro.
 */
import { apiGet, apiPost, apiPut, apiDelete } from './api';

/**
 * Executa a rotina listar usuarios.
 */
export async function listarUsuarios() {
  return apiGet('/usuarios');
}

/**
 * Executa a rotina buscar usuario por id.
 */
export async function buscarUsuarioPorId(id) {
  return apiGet(`/usuarios/${id}`);
}

/**
 * Executa a rotina listar permissoes.
 */
export async function listarPermissoes() {
  return apiGet('/permissoes');
}

/**
 * Executa a rotina criar usuario.
 */
export async function criarUsuario({ nome, email, senha, role_id, permissoes }) {
  return apiPost('/usuarios', {
    nome,
    email,
    senha,
    role_id,
    permissoes
  });
}

/**
 * Executa a rotina atualizar usuario.
 */
export async function atualizarUsuario(id, dados) {
  return apiPut(`/usuarios/${id}`, dados);
}

/**
 * Executa a rotina deletar usuario.
 */
export async function deletarUsuario(id) {
  return apiDelete(`/usuarios/${id}`);
}
