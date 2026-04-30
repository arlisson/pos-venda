import { apiDelete, apiGet, apiPost, apiPut } from './api';

export const getMetas = async () => {
  const data = await apiGet('/metas');
  return data;
};

export const updateMetas = async (metas) => {
  const data = await apiPut('/metas', { metas });
  return data;
};

export const createMeta = async (meta) => {
  const data = await apiPost('/metas', meta);
  return data;
};

export const deleteMeta = async (id) => {
  await apiDelete(`/metas/${id}`);
};

export const getProgresso = async () => {
  const data = await apiGet('/metas/progresso');
  return data;
};

export const getProgressoUsuarios = async () => {
  const data = await apiGet('/metas/progresso/usuarios');
  return data;
};

export const resgatarMeta = async (id) => {
  const data = await apiPost(`/metas/${id}/resgatar`, {});
  return data;
};
