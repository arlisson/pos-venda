/**
 * Cliente de API para notas vinculadas a entidades do sistema.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './api';

/**
 * Lista notas entidade conforme os filtros e parametros informados.
 */
export async function listarNotasEntidade(tipo, id) {
  return apiGet(`/notas/${tipo}/${id}`);
}

/**
 * Cria nota entidade com os dados informados.
 */
export async function criarNotaEntidade(tipo, id, dados) {
  return apiPost(`/notas/${tipo}/${id}`, dados);
}

/**
 * Atualiza nota com os dados informados.
 */
export async function atualizarNota(id, dados) {
  return apiPut(`/notas/${id}`, dados);
}

/**
 * Exclui nota conforme a regra de negocio.
 */
export async function excluirNota(id) {
  return apiDelete(`/notas/${id}`);
}
