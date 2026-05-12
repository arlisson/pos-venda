const express = require('express');
const router = express.Router();

const leadPlanilhaController = require('../controllers/lead-planilha.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get('/me/envios', leadPlanilhaController.meusEnvios);
router.get('/me/linhas', leadPlanilhaController.minhasLinhas);
router.get('/me/futuros-clientes', exigirUmaPermissao(['futuros_clientes_ver']), leadPlanilhaController.listarFuturosClientes);
router.get('/me/futuros-clientes/lixeira', exigirUmaPermissao(['futuros_clientes_ver']), leadPlanilhaController.listarFuturosClientesLixeira);
router.delete(
  '/me/futuros-clientes/:id',
  exigirUmaPermissao(['futuros_clientes_registrar']),
  auditar({
    acao: 'lead_linha.futuro_cliente_enviado_lixeira',
    entidade: 'lead_linhas',
    entidade_id: req => req.params.id,
    dados: req => ({ linha_id: req.params.id, usuario_id: req.usuario?.id })
  }),
  leadPlanilhaController.excluirFuturoCliente
);
router.post(
  '/me/futuros-clientes/:id/restaurar',
  exigirUmaPermissao(['futuros_clientes_registrar']),
  auditar({
    acao: 'lead_linha.futuro_cliente_restaurado',
    entidade: 'lead_linhas',
    entidade_id: req => req.params.id,
    dados: req => ({ linha_id: req.params.id, usuario_id: req.usuario?.id })
  }),
  leadPlanilhaController.restaurarFuturoCliente
);
router.delete(
  '/me/futuros-clientes/:id/definitivo',
  exigirUmaPermissao(['futuros_clientes_registrar']),
  auditar({
    acao: 'lead_linha.futuro_cliente_excluido_definitivamente',
    entidade: 'lead_linhas',
    entidade_id: req => req.params.id,
    dados: req => ({ linha_id: req.params.id, usuario_id: req.usuario?.id })
  }),
  leadPlanilhaController.excluirFuturoClienteDefinitivo
);
router.post('/me/exportar', leadPlanilhaController.exportarMinhas);
router.post(
  '/me/linhas/:id/futuro-cliente',
  exigirUmaPermissao(['futuros_clientes_registrar']),
  auditar({
    acao: 'lead_linha.futuro_cliente_marcado',
    entidade: 'lead_linhas',
    entidade_id: (req, resultado) => resultado?.linha?.id || req.params.id,
    dados: (req, resultado) => ({
      linha_id: req.params.id,
      notas: req.body?.notas,
      retorno: req.body?.retorno,
      usuario_id: req.usuario?.id
    })
  }),
  leadPlanilhaController.marcarFuturoCliente
);
router.put(
  '/me/linhas/:id/campo-atualizado',
  auditar({
    acao: 'lead_linha.campo_atualizado',
    entidade: 'lead_linhas',
    entidade_id: (req, resultado) => resultado?.linha?.id || req.params.id,
    dados: (req, resultado) => ({
      coluna: resultado?.coluna || req.body?.coluna,
      coluna_atualizada: resultado?.coluna_atualizada,
      usuario_id: req.usuario?.id
    })
  }),
  leadPlanilhaController.atualizarMeuCampo
);

router.get('/', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.index);
router.post('/uploads', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.upload);
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
router.post('/:id/finalizar', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.finalizar);
router.post('/:id/erro', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.erro);
router.put('/:id/schema', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.updateSchema);
router.get('/:id/status', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.status);
router.delete(
  '/:id',
  exigirUmaPermissao(['gerenciar_leads']),
  auditar({
    acao: 'lead_planilha.excluida',
    entidade: 'lead_planilhas',
    entidade_id: req => req.params.id,
    dados: req => ({ planilha_id: req.params.id })
  }),
  leadPlanilhaController.destroy
);
router.get('/linhas', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.linhas);
router.get('/envios', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.envios);
router.post('/exportar', exigirUmaPermissao(['gerenciar_leads']), leadPlanilhaController.exportar);
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
