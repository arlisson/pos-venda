import { apiDelete, apiGet, apiPost, apiPut } from './api';

export async function listarNotasEntidade(tipo, id) {
  return apiGet(`/notas/${tipo}/${id}`);
}

export async function criarNotaEntidade(tipo, id, dados) {
  return apiPost(`/notas/${tipo}/${id}`, dados);
}

export async function atualizarNota(id, dados) {
  return apiPut(`/notas/${id}`, dados);
}

export async function excluirNota(id) {
  return apiDelete(`/notas/${id}`);
}
