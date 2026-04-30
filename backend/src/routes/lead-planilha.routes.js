const express = require('express');
const router = express.Router();

const leadPlanilhaController = require('../controllers/lead-planilha.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/me/envios', leadPlanilhaController.meusEnvios);
router.get('/me/linhas', leadPlanilhaController.minhasLinhas);

router.get('/', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.index);
router.post(
  '/',
  exigirUmaPermissao(['gerenciar_leads']),
  auditar({
    acao: 'lead_planilha.criada',
    entidade: 'lead_planilhas',
    entidade_id: (req, planilha) => planilha?.id,
    dados: (req, planilha) => ({ planilha, payload: req.body })
  }),
  leadPlanilhaController.store
);
router.post('/:id/linhas', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.storeLinhas);
router.put('/:id/schema', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.updateSchema);
router.get('/linhas', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.linhas);
router.get('/envios', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.envios);
router.post(
  '/dividir',
  exigirUmaPermissao(['gerenciar_leads']),
  auditar({
    acao: 'lead_envio.criado',
    entidade: 'lead_envios',
    entidade_id: (req, resultado) => resultado?.envio?.id,
    dados: req => ({ payload: req.body })
  }),
  leadPlanilhaController.dividir
);

module.exports = router;
