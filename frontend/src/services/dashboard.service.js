/**
 * Cliente de API para contexto do dashboard.
 */
import { apiGet } from './api';

export async function obterContextoNotificacoesDashboard() {
  return apiGet('/dashboard/notificacoes-contexto');
}
