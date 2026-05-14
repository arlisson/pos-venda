const express = require('express');
const router = express.Router();

const vendaController = require('../controllers/venda.controller');
const vendaArquivoController = require('../controllers/venda-arquivo.controller');
const vendaProblemaController = require('../controllers/venda-problema.controller');
const vendaAprovacaoController = require('../controllers/venda-aprovacao.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/audit.middleware');
const { exigirUmaPermissao } = require('../middlewares/permissao.middleware');

function obterMovimentacaoStatus(venda) {
  const historico = Array.isArray(venda?.historico) ? venda.historico : [];
  const movimentacao = historico.find(item => item.status_novo || item.status_anterior);

  if (!movimentacao) {
    return null;
  }

  return {
    acao: movimentacao.acao,
    status_anterior: movimentacao.status_anterior || null,
    status_novo: movimentacao.status_novo || null,
    observacao: movimentacao.observacao || null
  };
}

router.use(authMiddleware);

router.get('/vendedoras', exigirUmaPermissao(['vendas', 'vendas_criar', 'vendas_editar', 'compartilhar_venda', 'vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas', 'relatorios_visualizar']), vendaController.vendedoras);
router.get('/resumo', exigirUmaPermissao(['dashboard_resumo_vendas', 'vendas', 'vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaController.resumo);
router.get('/relatorios', exigirUmaPermissao(['relatorios_visualizar']), vendaController.relatorios);
router.get('/lixeira', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaController.lixeira);
router.get('/', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaController.index);
router.get('/problemas/destinatarios', exigirUmaPermissao(['pos_venda']), vendaProblemaController.destinatarios);
router.get('/aprovacoes', exigirUmaPermissao(['vendas_aprovacoes_visualizar']), vendaAprovacaoController.index);
router.post('/aprovacoes/:id/aprovar', exigirUmaPermissao(['vendas_aprovacoes_decidir']), vendaAprovacaoController.aprovar);
router.post('/aprovacoes/:id/recusar', exigirUmaPermissao(['vendas_aprovacoes_decidir']), vendaAprovacaoController.recusar);
router.post('/problemas/:problemaId/resolver', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaProblemaController.resolver);
router.post('/problemas/:problemaId/correcao', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaProblemaController.correcao);
router.post('/problemas/:problemaId/verificar', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaProblemaController.verificar);
router.get('/:id/problemas', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaProblemaController.index);
router.get('/:id/problemas/ativo', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaProblemaController.ativo);
router.post('/:id/problemas', exigirUmaPermissao(['pos_venda']), vendaProblemaController.store);
router.get('/:id/arquivos', exigirUmaPermissao(['vendas_documentos', 'adicionar_documentos']), exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaArquivoController.index);
router.post('/:id/arquivos', exigirUmaPermissao(['adicionar_documentos']), vendaArquivoController.store);
router.get('/:id/arquivos/pacote', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaArquivoController.pacoteShow);
router.post('/:id/arquivos/pacote', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_editar', 'editar_vendas_compartilhadas']), vendaArquivoController.pacoteStore);
router.get('/:id/arquivos/pacote/download', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaArquivoController.pacoteDownload);
router.get('/:id/arquivos/:arquivoVendaId/download', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaArquivoController.download);
router.get('/:id/arquivos/:arquivoVendaId/view', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaArquivoController.view);
router.delete('/:id/arquivos/:arquivoVendaId', exigirUmaPermissao(['vendas_documentos']), exigirUmaPermissao(['vendas_editar', 'editar_vendas_compartilhadas']), vendaArquivoController.destroy);
router.get('/:id', exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']), vendaController.show);
router.post(
  '/:id/email-template',
  exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']),
  vendaController.emailTemplate
);
router.post(
  '/:id/enviar-pos-venda',
  exigirUmaPermissao(['vendas_editar', 'editar_vendas_compartilhadas']),
  auditar({
    acao: 'venda.enviada_pos_venda',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: (req, venda) => ({
      id: req.params.id,
      status_funil: venda?.status_funil || null,
      movimentacao: obterMovimentacaoStatus(venda)
    })
  }),
  vendaController.enviarPosVenda
);
router.get(
  '/:id/xlsx-claro',
  exigirUmaPermissao(['vendas_ver_proprias', 'ver_vendas_compartilhadas', 'vendas_ver_todas']),
  vendaController.xlsxClaro
);
router.post(
  '/',
  exigirUmaPermissao(['vendas_criar']),
  auditar({
    acao: 'venda.criada',
    entidade: 'vendas',
    entidade_id: (req, venda) => venda?.id,
    dados: (req, venda) => ({
      venda,
      payload: req.body
    })
  }),
  vendaController.store
);
router.put(
  '/:id',
  exigirUmaPermissao(['vendas_editar', 'editar_vendas_compartilhadas', 'pos_venda']),
  auditar({
    acao: 'venda.atualizada',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id,
      alteracoes: req.body
    })
  }),
  vendaController.update
);
router.patch(
  '/:id/status',
  exigirUmaPermissao(['vendas_editar', 'pos_venda']),
  auditar({
    acao: 'venda.status_atualizado',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: (req, venda) => ({
      id: req.params.id,
      alteracoes: req.body,
      status_funil: venda?.status_funil || null,
      movimentacao: obterMovimentacaoStatus(venda)
    })
  }),
  vendaController.updateStatus
);
router.delete(
  '/:id/definitivo',
  exigirUmaPermissao(['vendas_excluir']),
  auditar({
    acao: 'venda.excluida_definitivamente',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  vendaController.destroyDefinitivo
);
router.post(
  '/:id/restaurar',
  exigirUmaPermissao(['vendas_excluir']),
  auditar({
    acao: 'venda.restaurada',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  vendaController.restore
);
router.delete(
  '/:id',
  exigirUmaPermissao(['vendas_excluir']),
  auditar({
    acao: 'venda.enviada_lixeira',
    entidade: 'vendas',
    entidade_id: req => req.params.id,
    dados: req => ({
      id: req.params.id
    })
  }),
  vendaController.destroy
);

module.exports = router;
