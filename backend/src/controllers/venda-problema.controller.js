const vendaProblemaService = require('../services/venda-problema.service');

function responderErro(res, error, fallback) {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    message: error.message || fallback
  });
}

async function store(req, res) {
  try {
    const problema = await vendaProblemaService.abrirProblema(req.params.id, req.body, req.usuario.id);
    return res.status(201).json(problema);
  } catch (error) {
    return responderErro(res, error, 'Erro ao marcar problema na venda.');
  }
}

async function destinatarios(req, res) {
  try {
    const usuarios = await vendaProblemaService.listarDestinatariosDisponiveis();
    return res.json(usuarios);
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar responsaveis.');
  }
}

async function ativo(req, res) {
  try {
    const problema = await vendaProblemaService.obterAtivo(req.params.id, req.usuario.id);
    return res.json(problema || null);
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar problema ativo da venda.');
  }
}

async function resolver(req, res) {
  try {
    const problema = await vendaProblemaService.resolverProblema(req.params.problemaId, req.body, req.usuario.id);
    return res.json(problema);
  } catch (error) {
    return responderErro(res, error, 'Erro ao resolver problema da venda.');
  }
}

async function correcao(req, res) {
  try {
    const problema = await vendaProblemaService.solicitarCorrecao(req.params.problemaId, req.body, req.usuario.id);
    return res.json(problema);
  } catch (error) {
    return responderErro(res, error, 'Erro ao solicitar nova correcao.');
  }
}

async function verificar(req, res) {
  try {
    const problema = await vendaProblemaService.verificarProblema(req.params.problemaId, req.usuario.id);
    return res.json(problema);
  } catch (error) {
    return responderErro(res, error, 'Erro ao verificar problema da venda.');
  }
}

module.exports = {
  destinatarios,
  store,
  ativo,
  resolver,
  correcao,
  verificar
};
