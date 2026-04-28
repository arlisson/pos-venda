const Meta = require('../models/Meta');

function validarMeta(meta) {
  if (!meta.desc || !meta.target) {
    return 'Alvo e descricao sao obrigatorios.';
  }

  if (!Meta.periodosValidos.includes(meta.periodo)) {
    return 'Periodo invalido.';
  }

  if (!Meta.categoriasValidas.includes(meta.categoria)) {
    return 'Categoria invalida.';
  }

  return null;
}

function metaEhGift(meta) {
  return meta.is_gift === true || meta.is_gift === 1 || meta.is_gift === '1';
}

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
        return res.status(400).json({ error: 'Formato invalido. Esperado um array de metas.' });
      }

      const invalida = metas.find(meta => metaEhGift(meta) && validarMeta(meta));
      if (invalida) {
        return res.status(400).json({ error: validarMeta(invalida) });
      }

      await Meta.updateAll(metas);
      const updatedMetas = await Meta.findAll();

      res.json({ message: 'Metas atualizadas com sucesso.', metas: updatedMetas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar metas.' });
    }
  }

  async store(req, res) {
    try {
      const erro = validarMeta(req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const meta = await Meta.create({
        periodo: req.body.periodo,
        categoria: req.body.categoria,
        target: Number(req.body.target),
        desc: req.body.desc,
        reward: req.body.reward,
        is_gift: true
      });

      res.status(201).json(meta);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar meta.' });
    }
  }

  async destroy(req, res) {
    try {
      const deleted = await Meta.deleteById(req.params.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Meta nao encontrada.' });
      }

      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir meta.' });
    }
  }
}

module.exports = new MetaController();
