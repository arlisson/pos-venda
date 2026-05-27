const notaService = require('../services/nota.service');

/**
 * Lista notas vinculadas a uma entidade permitida.
 *
 * @param {import('express').Request} req - Requisicao com tipo e id da entidade em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Lista de notas ou erro 404.
 */
async function index(req, res) {
  try {
    const notas = await notaService.listarNotas(req.params.tipo, req.params.id, req.usuario.id);

    if (!notas) {
      return res.status(404).json({ message: 'Entidade não encontrada.' });
    }

    return res.json(notas);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Erro ao listar notas.' });
  }
}

/**
 * Cria uma nota para uma entidade do sistema.
 *
 * @param {import('express').Request} req - Requisicao com entidade na rota e dados da nota em req.body.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Nota criada ou erro de validacao.
 */
async function store(req, res) {
  try {
    const nota = await notaService.criarNota(req.params.tipo, req.params.id, req.usuario.id, req.body);

    if (!nota) {
      return res.status(404).json({ message: 'Entidade não encontrada.' });
    }

    return res.status(201).json(nota);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Erro ao criar nota.' });
  }
}

/**
 * Atualiza uma nota existente.
 *
 * @param {import('express').Request} req - Requisicao com notaId em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response>} Nota atualizada ou erro 404.
 */
async function update(req, res) {
  try {
    const nota = await notaService.atualizarNota(req.params.notaId, req.usuario.id, req.body);

    if (!nota) {
      return res.status(404).json({ message: 'Nota não encontrada.' });
    }

    return res.json(nota);
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Erro ao atualizar nota.' });
  }
}

/**
 * Remove uma nota do sistema.
 *
 * @param {import('express').Request} req - Requisicao com notaId em req.params.
 * @param {import('express').Response} res - Resposta HTTP.
 * @returns {Promise<import('express').Response|void>} Status 204 quando removida.
 */
async function destroy(req, res) {
  try {
    const total = await notaService.excluirNota(req.params.notaId, req.usuario.id);

    if (!total) {
      return res.status(404).json({ message: 'Nota não encontrada.' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir nota.' });
  }
}

module.exports = {
  index,
  store,
  update,
  destroy
};
