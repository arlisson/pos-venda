import { apiDelete, apiGet, apiPost, apiPut } from './api';

function montarQuery(filtros = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    params.append(chave, valor);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listarPlanos(filtros = {}) {
  return apiGet(`/planos${montarQuery(filtros)}`);
}

export async function criarPlano(dados) {
  return apiPost('/planos', dados);
}

export async function atualizarPlano(id, dados) {
  return apiPut(`/planos/${id}`, dados);
}

export async function excluirPlano(id) {
  return apiDelete(`/planos/${id}`);
}
