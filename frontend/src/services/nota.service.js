/**
 * Cliente de API para notas vinculadas a entidades do sistema.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './api';

/**
 * Executa a rotina listar notas entidade.
 */
export async function listarNotasEntidade(tipo, id) {
  return apiGet(`/notas/${tipo}/${id}`);
}

/**
 * Executa a rotina criar nota entidade.
 */
export async function criarNotaEntidade(tipo, id, dados) {
  return apiPost(`/notas/${tipo}/${id}`, dados);
}

/**
 * Executa a rotina atualizar nota.
 */
export async function atualizarNota(id, dados) {
  return apiPut(`/notas/${id}`, dados);
}

/**
 * Executa a rotina excluir nota.
 */
export async function excluirNota(id) {
  return apiDelete(`/notas/${id}`);
}
