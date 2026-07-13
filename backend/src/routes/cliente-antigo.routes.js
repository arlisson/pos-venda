const express = require('express');
const router = express.Router();

const clienteAntigoController = require('../controllers/cliente-antigo.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirPermissao } = require('../middlewares/permissao.middleware');

router.use(authMiddleware);

router.get(
  '/buscar',
  exigirPermissao('clientes_antigos_buscar'),
  auditar({
    acao: 'cliente_antigo.busca_realizada',
    entidade: 'clientes_antigos',
    entidade_id: null,
    dados: (req, resultado) => ({
      termo: req.query?.termo || null,
      tipo: resultado?.tipo || null,
      encontrou: !!resultado?.encontrado,
      total: Number(resultado?.total || 0),
      page: Number(resultado?.page || req.query?.page || 1),
      per_page: Number(resultado?.per_page || req.query?.per_page || 20)
    })
  }),
  clienteAntigoController.buscar
);

router.get('/historico', exigirPermissao('clientes_antigos_ver_historico'), clienteAntigoController.historico);

router.patch(
  '/:id',
  exigirPermissao('clientes_antigos_editar'),
  auditar({
    acao: 'cliente_antigo.atualizado',
    entidade: 'clientes_antigos',
    entidade_id: (req, resultado) => resultado?.id || req.params.id,
    dados: (req, resultado) => ({
      id: resultado?.id || req.params.id,
      campos: Object.keys(req.body || {})
    })
  }),
  clienteAntigoController.atualizar
);

router.delete(
  '/:id',
  exigirPermissao('clientes_antigos_editar'),
  auditar({
    acao: 'cliente_antigo.excluido',
    entidade: 'clientes_antigos',
    entidade_id: (req, resultado) => resultado?.id || req.params.id,
    dados: (req, resultado) => ({
      id: resultado?.id || req.params.id,
      excluido: true
    })
  }),
  clienteAntigoController.excluir
);
router.post('/planilha/preview', exigirPermissao('clientes_antigos_gerenciar'), clienteAntigoController.planilhaPreview);
router.post('/planilha/importar', exigirPermissao('clientes_antigos_gerenciar'), clienteAntigoController.planilhaImportar);

module.exports = router;
