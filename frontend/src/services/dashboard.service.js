import { apiGet } from './api';

export async function obterContextoNotificacoesDashboard() {
  return apiGet('/dashboard/notificacoes-contexto');
}
