const leadPlanilhaService = require('../services/lead-planilha.service');

async function index(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarPlanilhas());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar planilhas de leads.' });
  }
}

async function store(req, res) {
  try {
    const planilha = await leadPlanilhaService.criarPlanilha(req.body, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar planilha.' });
  }
}

async function storeLinhas(req, res) {
  try {
    const resultado = await leadPlanilhaService.salvarLinhasLote(req.params.id, req.body.linhas || []);
    return res.status(201).json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao salvar linhas da planilha.' });
  }
}

async function updateSchema(req, res) {
  try {
    const planilha = await leadPlanilhaService.atualizarSchema(req.params.id, req.body.schema_colunas);

    if (!planilha) {
      return res.status(404).json({ message: 'Planilha nao encontrada.' });
    }

    return res.json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao atualizar schema.' });
  }
}

async function linhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar linhas de leads.' });
  }
}

async function dividir(req, res) {
  try {
    return res.json(await leadPlanilhaService.dividirLeads(req.body, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao dividir leads.' });
  }
}

async function envios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarTodosEnvios());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar envios.' });
  }
}

async function meusEnvios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarEnviosDoUsuario(req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar leads recebidos.' });
  }
}

async function minhasLinhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query, { usuarioId: req.usuario.id }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar leads recebidos.' });
  }
}

module.exports = {
  index,
  store,
  storeLinhas,
  updateSchema,
  linhas,
  dividir,
  envios,
  meusEnvios,
  minhasLinhas
};
