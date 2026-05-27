/**
 * Cliente de API para contexto do dashboard.
 */
import { apiGet } from './api';

/**
 * Executa a rotina obter contexto notificacoes dashboard.
 */
export async function obterContextoNotificacoesDashboard() {
  return apiGet('/dashboard/notificacoes-contexto');
}
