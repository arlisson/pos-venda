/**
 * Cliente de API para configuracoes, cadastros auxiliares e listas administrativas.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './api';

/**
 * Executa a rotina listar operadoras.
 */
export async function listarOperadoras() {
  return apiGet('/config/operadoras');
}

/**
 * Executa a rotina listar links externos.
 */
export async function listarLinksExternos() {
  return apiGet('/config/links-externos');
}

/**
 * Executa a rotina listar tipos produto.
 */
export async function listarTiposProduto() {
  return apiGet('/config/tipos-produto');
}

/**
 * Executa a rotina listar tipos venda.
 */
export async function listarTiposVenda() {
  return apiGet('/config/tipos-venda');
}

/**
 * Executa a rotina listar servicos.
 */
export async function listarServicos() {
  return apiGet('/config/servicos');
}

/**
 * Executa a rotina listar etapas funil.
 */
export async function listarEtapasFunil() {
  return apiGet('/config/funil-etapas');
}

/**
 * Executa a rotina listar regras comissao.
 */
export async function listarRegrasComissao() {
  return apiGet('/config/regras-comissao');
}

/**
 * Executa a rotina listar operadoras admin.
 */
export async function listarOperadorasAdmin() {
  return apiGet('/config/admin/operadoras');
}

/**
 * Executa a rotina criar operadora.
 */
export async function criarOperadora(dados) {
  return apiPost('/config/admin/operadoras', dados);
}

/**
 * Executa a rotina atualizar operadora.
 */
export async function atualizarOperadora(id, dados) {
  return apiPut(`/config/admin/operadoras/${id}`, dados);
}

/**
 * Executa a rotina excluir operadora.
 */
export async function excluirOperadora(id) {
  return apiDelete(`/config/admin/operadoras/${id}`);
}

/**
 * Executa a rotina listar tipos produto admin.
 */
export async function listarTiposProdutoAdmin() {
  return apiGet('/config/admin/tipos-produto');
}

/**
 * Executa a rotina criar tipo produto.
 */
export async function criarTipoProduto(dados) {
  return apiPost('/config/admin/tipos-produto', dados);
}

/**
 * Executa a rotina atualizar tipo produto.
 */
export async function atualizarTipoProduto(id, dados) {
  return apiPut(`/config/admin/tipos-produto/${id}`, dados);
}

/**
 * Executa a rotina excluir tipo produto.
 */
export async function excluirTipoProduto(id) {
  return apiDelete(`/config/admin/tipos-produto/${id}`);
}

/**
 * Executa a rotina listar tipos venda admin.
 */
export async function listarTiposVendaAdmin() {
  return apiGet('/config/admin/tipos-venda');
}

/**
 * Executa a rotina criar tipo venda.
 */
export async function criarTipoVenda(dados) {
  return apiPost('/config/admin/tipos-venda', dados);
}

/**
 * Executa a rotina atualizar tipo venda.
 */
export async function atualizarTipoVenda(id, dados) {
  return apiPut(`/config/admin/tipos-venda/${id}`, dados);
}

/**
 * Executa a rotina excluir tipo venda.
 */
export async function excluirTipoVenda(id) {
  return apiDelete(`/config/admin/tipos-venda/${id}`);
}

/**
 * Executa a rotina listar servicos admin.
 */
export async function listarServicosAdmin() {
  return apiGet('/config/admin/servicos');
}

/**
 * Executa a rotina criar servico.
 */
export async function criarServico(dados) {
  return apiPost('/config/admin/servicos', dados);
}

/**
 * Executa a rotina atualizar servico.
 */
export async function atualizarServico(id, dados) {
  return apiPut(`/config/admin/servicos/${id}`, dados);
}

/**
 * Executa a rotina excluir servico.
 */
export async function excluirServico(id) {
  return apiDelete(`/config/admin/servicos/${id}`);
}

/**
 * Executa a rotina listar etapas funil admin.
 */
export async function listarEtapasFunilAdmin() {
  return apiGet('/config/admin/funil-etapas');
}

/**
 * Executa a rotina criar etapa funil.
 */
export async function criarEtapaFunil(dados) {
  return apiPost('/config/admin/funil-etapas', dados);
}

/**
 * Executa a rotina atualizar etapa funil.
 */
export async function atualizarEtapaFunil(id, dados) {
  return apiPut(`/config/admin/funil-etapas/${id}`, dados);
}

/**
 * Executa a rotina excluir etapa funil.
 */
export async function excluirEtapaFunil(id) {
  return apiDelete(`/config/admin/funil-etapas/${id}`);
}

/**
 * Executa a rotina reordenar etapas funil.
 */
export async function reordenarEtapasFunil(ordens) {
  return apiPut('/config/admin/funil-etapas/reorder', { ordens });
}

/**
 * Executa a rotina listar regras comissao admin.
 */
export async function listarRegrasComissaoAdmin() {
  return apiGet('/config/admin/regras-comissao');
}

/**
 * Executa a rotina criar regra comissao.
 */
export async function criarRegraComissao(dados) {
  return apiPost('/config/admin/regras-comissao', dados);
}

/**
 * Executa a rotina atualizar regra comissao.
 */
export async function atualizarRegraComissao(id, dados) {
  return apiPut(`/config/admin/regras-comissao/${id}`, dados);
}

/**
 * Executa a rotina excluir regra comissao.
 */
export async function excluirRegraComissao(id) {
  return apiDelete(`/config/admin/regras-comissao/${id}`);
}

/**
 * Executa a rotina listar links externos admin.
 */
export async function listarLinksExternosAdmin() {
  return apiGet('/config/admin/links-externos');
}

/**
 * Executa a rotina criar link externo.
 */
export async function criarLinkExterno(dados) {
  return apiPost('/config/admin/links-externos', dados);
}

/**
 * Executa a rotina atualizar link externo.
 */
export async function atualizarLinkExterno(id, dados) {
  return apiPut(`/config/admin/links-externos/${id}`, dados);
}

/**
 * Executa a rotina excluir link externo.
 */
export async function excluirLinkExterno(id) {
  return apiDelete(`/config/admin/links-externos/${id}`);
}
