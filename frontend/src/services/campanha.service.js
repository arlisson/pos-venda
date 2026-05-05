import { apiDelete, apiGet, apiPost, apiPut } from './api';

export const getCampanhas = async () => {
  const data = await apiGet('/campanhas');
  return data;
};

export const updateCampanhas = async (campanhas) => {
  const data = await apiPut('/campanhas', { campanhas });
  return data;
};

export const createCampanha = async (campanha) => {
  const data = await apiPost('/campanhas', campanha);
  return data;
};

export const deleteCampanha = async (id) => {
  await apiDelete(`/campanhas/${id}`);
};

export const getProgresso = async () => {
  const data = await apiGet('/campanhas/progresso');
  return data;
};

export const getProgressoUsuarios = async () => {
  const data = await apiGet('/campanhas/progresso/usuarios');
  return data;
};

export const resgatarCampanha = async (id) => {
  const data = await apiPost(`/campanhas/${id}/resgatar`, {});
  return data;
};
