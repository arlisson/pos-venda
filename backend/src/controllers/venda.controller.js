const vendaService = require('../services/venda.service');
const { gerarXlsxClaro } = require('../services/venda-xlsx-claro.service');
const { _internals } = require('../services/venda-email-template.service');

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

async function resumo(req, res) {
  try {
    const resumoDashboard = await vendaService.obterResumoDashboard(req.usuario.id);

    return res.json(resumoDashboard);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao carregar resumo de vendas.'
    });
  }
}

async function relatorios(req, res) {
  try {
    const relatorio = await vendaService.obterRelatoriosVendas(req.query, req.usuario.id);

    return res.json(relatorio);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao carregar relatórios de vendas.'
    });
  }
}

async function show(req, res) {
  try {
    const venda = await vendaService.buscarVendaPorId(req.params.id, req.usuario.id);

    if (!venda) {
      return res.status(404).json({
        message: 'Venda não encontrada.'
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

async function emailTemplate(req, res) {
  try {
    const resultado = await vendaService.gerarEmailTemplateVenda(req.params.id, req.usuario.id);

    if (!resultado) {
      return res.status(404).json({
        message: 'Venda não encontrada.'
      });
    }

    return res.json(resultado);
  } catch (error) {
    console.error(error);

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao gerar corpo de email.'
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
        message: 'Venda não encontrada.'
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
        message: 'Venda não encontrada.'
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
        message: 'Venda não encontrada.'
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

async function lixeira(req, res) {
  try {
    const vendas = await vendaService.listarVendasLixeira(req.query, req.usuario.id);

    return res.json(vendas);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar lixeira de vendas.'
    });
  }
}

async function restore(req, res) {
  try {
    const venda = await vendaService.restaurarVenda(req.params.id, req.usuario.id);

    if (!venda) {
      return res.status(404).json({
        message: 'Venda não encontrada na lixeira.'
      });
    }

    return res.json(venda);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao restaurar venda.'
    });
  }
}

async function destroyDefinitivo(req, res) {
  try {
    const totalExcluido = await vendaService.excluirVendaDefinitivo(req.params.id, req.usuario.id);

    if (!totalExcluido) {
      return res.status(404).json({
        message: 'Venda não encontrada na lixeira.'
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao excluir venda definitivamente.'
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

async function xlsxClaro(req, res) {
  try {
    const venda = await vendaService.buscarVendaPorId(req.params.id, req.usuario.id);

    if (!venda) {
      return res.status(404).json({ message: 'Venda não encontrada.' });
    }

    const operadora = _internals.resolverOperadora(venda);
    if (operadora !== 'Claro') {
      return res.status(400).json({ message: 'Planilha disponível apenas para vendas Claro.' });
    }

    const buffer = await gerarXlsxClaro(venda);
    const nomeCliente = String(venda.razao_social || venda.cliente?.razao_social || venda.cliente?.nome || venda.id).replace(/[^\w\s-]/g, '').trim();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Claro_${nomeCliente}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao gerar planilha Claro.' });
  }
}

module.exports = {
  index,
  resumo,
  relatorios,
  show,
  emailTemplate,
  xlsxClaro,
  store,
  update,
  updateStatus,
  destroy,
  lixeira,
  restore,
  destroyDefinitivo,
  vendedoras
};
