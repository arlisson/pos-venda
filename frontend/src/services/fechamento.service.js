import { apiGet } from './api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    params.append(chave, valor);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getResumo(filtros = {}) {
  return apiGet(`/fechamento/resumo${montarQuery(filtros)}`);
}

export async function getDetalhes(filtros = {}) {
  return apiGet(`/fechamento/detalhes${montarQuery(filtros)}`);
}

export async function getDetalhesChips(filtros = {}) {
  return apiGet(`/fechamento/detalhes-chips${montarQuery(filtros)}`);
}

export async function getDossieVenda(id, filtros = {}) {
  return apiGet(`/fechamento/vendas/${id}/dossie${montarQuery(filtros)}`);
}
