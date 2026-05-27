/**
 * Cliente de API para fechamento mensal e exportacoes do periodo.
 */
import { apiBlob, apiGet } from './api';

/**
 * Monta query a partir dos dados informados.
 */
function montarQuery(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    params.append(chave, valor);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Retorna resumo a partir dos dados informados.
 */
export async function getResumo(filtros = {}) {
  return apiGet(`/fechamento/resumo${montarQuery(filtros)}`);
}

/**
 * Retorna detalhes a partir dos dados informados.
 */
export async function getDetalhes(filtros = {}) {
  return apiGet(`/fechamento/detalhes${montarQuery(filtros)}`);
}

/**
 * Retorna detalhes chips a partir dos dados informados.
 */
export async function getDetalhesChips(filtros = {}) {
  return apiGet(`/fechamento/detalhes-chips${montarQuery(filtros)}`);
}

/**
 * Retorna dossie venda a partir dos dados informados.
 */
export async function getDossieVenda(id, filtros = {}) {
  return apiGet(`/fechamento/vendas/${id}/dossie${montarQuery(filtros)}`);
}

/**
 * Baixa blob para o usuario.
 */
function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta vendas periodo no formato esperado.
 */
export async function exportarVendasPeriodo(filtros = {}) {
  const blob = await apiBlob(`/fechamento/exportar-vendas${montarQuery(filtros)}`);
  const inicio = filtros.data_inicio || 'inicio';
  const fim = filtros.data_fim || 'fim';
  baixarBlob(blob, `vendas-${inicio}-a-${fim}.xlsx`);
}
