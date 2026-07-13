const vendaEtapaService = require('../services/venda-etapa.service');

/**
 * Lista as etapas de conferencia de uma venda.
 *
 * @param {Object} req - Requisicao com vendaId em req.params.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Lista de etapas.
 */
async function index(req, res) {
  try {
    const etapas = await vendaEtapaService.obterEtapas(req.params.id, req.usuario.id);
    return res.json({ etapas });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao listar etapas da venda.'
    });
  }
}

/**
 * Marca ou desmarca a etapa 1 (verificacao com o 0800).
 *
 * @param {Object} req - Requisicao com { concluida } no body.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Etapas atualizadas.
 */
async function update0800(req, res) {
  try {
    const etapas = await vendaEtapaService.definirEtapa0800(
      req.params.id,
      Boolean(req.body?.concluida),
      req.usuario.id
    );

    return res.json({ etapas });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao atualizar etapa da venda.'
    });
  }
}

module.exports = {
  index,
  update0800
};
