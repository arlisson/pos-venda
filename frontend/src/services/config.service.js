import { apiDelete, apiGet, apiPost, apiPut } from './api';

export async function listarOperadoras() {
  return apiGet('/config/operadoras');
}

export async function listarLinksExternos() {
  return apiGet('/config/links-externos');
}

export async function listarTiposProduto() {
  return apiGet('/config/tipos-produto');
}

export async function listarTiposVenda() {
  return apiGet('/config/tipos-venda');
}

export async function listarServicos() {
  return apiGet('/config/servicos');
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

export async function listarTiposProdutoAdmin() {
  return apiGet('/config/admin/tipos-produto');
}

export async function criarTipoProduto(dados) {
  return apiPost('/config/admin/tipos-produto', dados);
}

export async function atualizarTipoProduto(id, dados) {
  return apiPut(`/config/admin/tipos-produto/${id}`, dados);
}

export async function excluirTipoProduto(id) {
  return apiDelete(`/config/admin/tipos-produto/${id}`);
}

export async function listarTiposVendaAdmin() {
  return apiGet('/config/admin/tipos-venda');
}

export async function criarTipoVenda(dados) {
  return apiPost('/config/admin/tipos-venda', dados);
}

export async function atualizarTipoVenda(id, dados) {
  return apiPut(`/config/admin/tipos-venda/${id}`, dados);
}

export async function excluirTipoVenda(id) {
  return apiDelete(`/config/admin/tipos-venda/${id}`);
}

export async function listarServicosAdmin() {
  return apiGet('/config/admin/servicos');
}

export async function criarServico(dados) {
  return apiPost('/config/admin/servicos', dados);
}

export async function atualizarServico(id, dados) {
  return apiPut(`/config/admin/servicos/${id}`, dados);
}

export async function excluirServico(id) {
  return apiDelete(`/config/admin/servicos/${id}`);
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
