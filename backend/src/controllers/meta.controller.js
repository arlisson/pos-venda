const Meta = require('../models/Meta');

class MetaController {
  async index(req, res) {
    try {
      const metas = await Meta.findAll();
      res.json(metas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar metas.' });
    }
  }

  async updateBulk(req, res) {
    try {
      const { metas } = req.body;
      if (!Array.isArray(metas)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array de metas.' });
      }

      await Meta.updateAll(metas);
      const updatedMetas = await Meta.findAll();

      res.json({ message: 'Metas atualizadas com sucesso.', metas: updatedMetas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar metas.' });
    }
  }
}

module.exports = new MetaController();
