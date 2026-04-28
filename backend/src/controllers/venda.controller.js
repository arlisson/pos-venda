const vendaService = require('../services/venda.service');

async function index(req, res) {
  try {
    const vendas = await vendaService.listarVendas(req.query, req.usuario.id);

    return res.json(vendas);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar vendas.'
    });
  }
}

async function show(req, res) {
  try {
    const venda = await vendaService.buscarVendaPorId(req.params.id, req.usuario.id);

    if (!venda) {
      return res.status(404).json({
        message: 'Venda nao encontrada.'
      });
    }

    return res.json(venda);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao buscar venda.'
    });
  }
}

async function store(req, res) {
  try {
    const venda = await vendaService.criarVenda(req.body, req.usuario.id);
    const vendaCompleta = await vendaService.buscarVendaPorId(venda.id);

    return res.status(201).json(vendaCompleta);
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao criar venda.'
    });
  }
}

async function update(req, res) {
  try {
    const venda = await vendaService.atualizarVenda(req.params.id, req.body, req.usuario.id);

    if (!venda) {
      return res.status(404).json({
        message: 'Venda nao encontrada.'
      });
    }

    const vendaCompleta = await vendaService.buscarVendaPorId(req.params.id, req.usuario.id);

    return res.json(vendaCompleta);
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao atualizar venda.'
    });
  }
}

async function updateStatus(req, res) {
  try {
    const resultado = await vendaService.atualizarStatusVenda(req.params.id, req.body, req.usuario.id);

    if (resultado.status === 'not_found') {
      return res.status(404).json({
        message: 'Venda nao encontrada.'
      });
    }

    if (resultado.status === 'invalid') {
      return res.status(400).json({
        message: resultado.message
      });
    }

    const vendaCompleta = await vendaService.buscarVendaPorId(req.params.id, req.usuario.id);

    return res.json(vendaCompleta);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao atualizar status da venda.'
    });
  }
}

async function destroy(req, res) {
  try {
    const totalExcluido = await vendaService.excluirVenda(req.params.id, req.usuario.id);

    if (!totalExcluido) {
      return res.status(404).json({
        message: 'Venda nao encontrada.'
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao excluir venda.'
    });
  }
}

async function vendedoras(req, res) {
  try {
    const usuarios = await vendaService.listarVendedoras();

    return res.json(usuarios);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar vendedoras.'
    });
  }
}

module.exports = {
  index,
  show,
  store,
  update,
  updateStatus,
  destroy,
  vendedoras
};
