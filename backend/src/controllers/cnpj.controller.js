const cnpjService = require('../services/cnpj.service');

/**
 * Converte codigos de erro do servico de CNPJ em status HTTP.
 *
 * @param {{ code?: string }} error - Erro lancado pela consulta de CNPJ.
 * @returns {number} Status HTTP correspondente.
 */
function getStatusErro(error) {
  if (error.code === 'cnpj_incompleto' || error.code === 'cnpj_invalido') return 400;
  if (error.code === 'nao_encontrado') return 404;
  if (error.code === 'limite') return 429;
  return 500;
}

/**
 * Consulta dados cadastrais de um CNPJ informado na rota.
 *
 * @param {import('express').Request} req - Requisicao com CNPJ em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Dados do CNPJ ou erro mapeado.
 */
async function consultar(req, res) {
  try {
    const dados = await cnpjService.consultarCnpj(req.params.cnpj);
    return res.json(dados);
  } catch (error) {
    const status = getStatusErro(error);

    if (status >= 500) {
      console.error(error);
    }

    return res.status(status).json({
      message: error.message || 'Erro ao consultar CNPJ.'
    });
  }
}

module.exports = {
  consultar
};
