import { apiGet, apiPut } from './api';

export const getMetas = async () => {
  const data = await apiGet('/metas');
  return data;
};

export const updateMetas = async (metas) => {
  const data = await apiPut('/metas', { metas });
  return data;
};
