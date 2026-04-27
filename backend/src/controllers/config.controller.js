const configService = require('../services/config.service');

async function operadoras(req, res) {
  try {
    const dados = await configService.listarOperadoras();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar operadoras.'
    });
  }
}

async function linksExternos(req, res) {
  try {
    const dados = await configService.listarLinksExternos();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar links externos.'
    });
  }
}

module.exports = {
  operadoras,
  linksExternos
};
