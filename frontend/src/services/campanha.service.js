/**
 * Cliente de API para campanhas, progresso e resgates.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './api';

/**
 * Executa a rotina get campanhas.
 */
export const getCampanhas = async () => {
  const data = await apiGet('/campanhas');
  return data;
};

/**
 * Executa a rotina update campanhas.
 */
export const updateCampanhas = async (campanhas) => {
  const data = await apiPut('/campanhas', { campanhas });
  return data;
};

/**
 * Executa a rotina create campanha.
 */
export const createCampanha = async (campanha) => {
  const data = await apiPost('/campanhas', campanha);
  return data;
};

/**
 * Executa a rotina delete campanha.
 */
export const deleteCampanha = async (id) => {
  await apiDelete(`/campanhas/${id}`);
};

/**
 * Executa a rotina get progresso.
 */
export const getProgresso = async () => {
  const data = await apiGet('/campanhas/progresso');
  return data;
};

/**
 * Executa a rotina get progresso usuarios.
 */
export const getProgressoUsuarios = async () => {
  const data = await apiGet('/campanhas/progresso/usuarios');
  return data;
};

/**
 * Executa a rotina resgatar campanha.
 */
export const resgatarCampanha = async (id) => {
  const data = await apiPost(`/campanhas/${id}/resgatar`, {});
  return data;
};
