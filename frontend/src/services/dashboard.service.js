/**
 * Cliente de API para contexto do dashboard.
 */
import { apiGet } from './api';

/**
 * Obtem contexto notificacoes dashboard a partir dos dados informados.
 */
export async function obterContextoNotificacoesDashboard() {
  return apiGet('/dashboard/notificacoes-contexto');
}
