const planoService = require('../services/plano.service');

async function index(req, res) {
  try {
    const planos = await planoService.listar(req.query);
    return res.json(planos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar planos.' });
  }
}

async function store(req, res) {
  try {
    const plano = await planoService.criar(req.body);
    return res.status(201).json(plano);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar plano.' });
  }
}

async function update(req, res) {
  try {
    const plano = await planoService.atualizar(req.params.id, req.body);

    if (!plano) {
      return res.status(404).json({ message: 'Plano nao encontrado.' });
    }

    return res.json(plano);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao atualizar plano.' });
  }
}

async function destroy(req, res) {
  try {
    const totalExcluido = await planoService.excluir(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Plano nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir plano.' });
  }
}

module.exports = {
  index,
  store,
  update,
  destroy
};
