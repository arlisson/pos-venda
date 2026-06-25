/**
 * Controller HTTP do cruzamento de vendas.
 *
 * Recebe a planilha principal e qualquer quantidade de planilhas secundarias,
 * gera o preview para configuracao do mapeamento e produz o .xlsx cruzado.
 */
const vendaCruzamentoService = require('../services/venda-cruzamento.service');

/**
 * Gera a pre-visualizacao das planilhas para configuracao do mapeamento.
 *
 * @param {Object} req - Requisicao multipart com as planilhas em ordem.
 * @param {Object} res - Resposta HTTP.
 * @returns {Promise.<Object>} Preview por planilha + sugestoes.
 */
async function preview(req, res) {
  try {
    const resultado = await vendaCruzamentoService.previewCruzamento(req);
    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao ler as planilhas.'
    });
  }
}

/**
 * Processa o cruzamento e devolve o arquivo cruzamento.xlsx para download.
 *
 * @param {Object} req - Requisicao multipart com planilhas + campo config (JSON).
 * @param {Object} res - Resposta HTTP (download do .xlsx).
 * @returns {Promise.<void>}
 */
async function processar(req, res) {
  try {
    const buffer = await vendaCruzamentoService.processarCruzamento(req);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="cruzamento.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao processar o cruzamento.'
    });
  }
}

module.exports = {
  preview,
  processar
};
