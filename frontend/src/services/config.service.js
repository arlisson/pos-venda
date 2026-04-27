import { apiDelete, apiGet, apiPost, apiPut } from './api';

export async function listarOperadoras() {
  return apiGet('/config/operadoras');
}

export async function listarLinksExternos() {
  return apiGet('/config/links-externos');
}

export async function listarOperadorasAdmin() {
  return apiGet('/config/admin/operadoras');
}

export async function criarOperadora(dados) {
  return apiPost('/config/admin/operadoras', dados);
}

export async function atualizarOperadora(id, dados) {
  return apiPut(`/config/admin/operadoras/${id}`, dados);
}

export async function excluirOperadora(id) {
  return apiDelete(`/config/admin/operadoras/${id}`);
}

export async function listarLinksExternosAdmin() {
  return apiGet('/config/admin/links-externos');
}

export async function criarLinkExterno(dados) {
  return apiPost('/config/admin/links-externos', dados);
}

export async function atualizarLinkExterno(id, dados) {
  return apiPut(`/config/admin/links-externos/${id}`, dados);
}

export async function excluirLinkExterno(id) {
  return apiDelete(`/config/admin/links-externos/${id}`);
}
