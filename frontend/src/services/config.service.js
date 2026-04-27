import { apiGet } from './api';

export async function listarOperadoras() {
  return apiGet('/config/operadoras');
}

export async function listarLinksExternos() {
  return apiGet('/config/links-externos');
}
