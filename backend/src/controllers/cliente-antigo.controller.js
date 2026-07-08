const clienteAntigoService = require('../services/cliente-antigo.service');

/**
 * Busca uma venda antiga por CNPJ (retorno enxuto) e registra o historico.
 */
async function buscar(req, res) {
  try {
    const resultado = await clienteAntigoService.buscarPorCnpj(req.query.cnpj, req.usuario);
    return res.json({ encontrado: !!resultado, venda: resultado });
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao buscar cliente antigo.'
    });
  }
}

/**
 * Lista paginada do historico de buscas de clientes antigos.
 */
async function historico(req, res) {
  try {
    const resultado = await clienteAntigoService.listarHistorico(req.query);
    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao listar historico de buscas.'
    });
  }
}

/**
 * Preview do upload da planilha de vendas antigas.
 */
async function planilhaPreview(req, res) {
  try {
    const preview = await clienteAntigoService.previewPlanilha(req);
    return res.json(preview);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao ler planilha.'
    });
  }
}

/**
 * Importa a planilha de vendas antigas para a base isolada.
 */
async function planilhaImportar(req, res) {
  try {
    const resultado = await clienteAntigoService.importarPlanilha(req, req.usuario?.id);
    return res.json(resultado);
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao importar planilha.'
    });
  }
}

module.exports = {
  buscar,
  historico,
  planilhaPreview,
  planilhaImportar
};
