const configService = require('../services/config.service');

async function operadoras(req, res) {
  try {
    const dados = await configService.listarOperadorasAtivas();

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
    const dados = await configService.listarLinksExternosAtivos();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar links externos.'
    });
  }
}

async function tiposProduto(req, res) {
  try {
    const dados = await configService.listarTiposProdutoAtivos();

    return res.json(dados);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar tipos de produto.'
    });
  }
}

async function tiposVenda(req, res) {
  try {
    const dados = await configService.listarTiposVendaAtivos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de venda.' });
  }
}

async function servicos(req, res) {
  try {
    const dados = await configService.listarServicosAtivos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar servicos.' });
  }
}

async function adminOperadoras(req, res) {
  try {
    const dados = await configService.listarOperadoras();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar operadoras.' });
  }
}

async function adminTiposProduto(req, res) {
  try {
    const dados = await configService.listarTiposProduto();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de produto.' });
  }
}

async function criarTipoProduto(req, res) {
  try {
    const tipoProduto = await configService.criarTipoProduto(req.body);
    return res.status(201).json(tipoProduto);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar tipo de produto.' });
  }
}

async function atualizarTipoProduto(req, res) {
  try {
    const tipoProduto = await configService.atualizarTipoProduto(req.params.id, req.body);

    if (!tipoProduto) {
      return res.status(404).json({ message: 'Tipo de produto nao encontrado.' });
    }

    return res.json(tipoProduto);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar tipo de produto.' });
  }
}

async function excluirTipoProduto(req, res) {
  try {
    const totalExcluido = await configService.excluirTipoProduto(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Tipo de produto nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir tipo de produto.' });
  }
}

async function adminTiposVenda(req, res) {
  try {
    const dados = await configService.listarTiposVenda();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de venda.' });
  }
}

async function criarTipoVenda(req, res) {
  try {
    const tipoVenda = await configService.criarTipoVenda(req.body);
    return res.status(201).json(tipoVenda);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar tipo de venda.' });
  }
}

async function atualizarTipoVenda(req, res) {
  try {
    const tipoVenda = await configService.atualizarTipoVenda(req.params.id, req.body);

    if (!tipoVenda) {
      return res.status(404).json({ message: 'Tipo de venda nao encontrado.' });
    }

    return res.json(tipoVenda);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar tipo de venda.' });
  }
}

async function excluirTipoVenda(req, res) {
  try {
    const totalExcluido = await configService.excluirTipoVenda(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Tipo de venda nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir tipo de venda.' });
  }
}

async function adminServicos(req, res) {
  try {
    const dados = await configService.listarServicos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar servicos.' });
  }
}

async function criarServico(req, res) {
  try {
    const servico = await configService.criarServico(req.body);
    return res.status(201).json(servico);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar servico.' });
  }
}

async function atualizarServico(req, res) {
  try {
    const servico = await configService.atualizarServico(req.params.id, req.body);

    if (!servico) {
      return res.status(404).json({ message: 'Servico nao encontrado.' });
    }

    return res.json(servico);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar servico.' });
  }
}

async function excluirServico(req, res) {
  try {
    const totalExcluido = await configService.excluirServico(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Servico nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir servico.' });
  }
}

async function criarOperadora(req, res) {
  try {
    const operadora = await configService.criarOperadora(req.body);
    return res.status(201).json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar operadora.' });
  }
}

async function atualizarOperadora(req, res) {
  try {
    const operadora = await configService.atualizarOperadora(req.params.id, req.body);

    if (!operadora) {
      return res.status(404).json({ message: 'Operadora nao encontrada.' });
    }

    return res.json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar operadora.' });
  }
}

async function excluirOperadora(req, res) {
  try {
    const totalExcluido = await configService.excluirOperadora(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Operadora nao encontrada.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir operadora.' });
  }
}

async function adminLinksExternos(req, res) {
  try {
    const dados = await configService.listarLinksExternos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar links externos.' });
  }
}

async function criarLinkExterno(req, res) {
  try {
    const link = await configService.criarLinkExterno(req.body);
    return res.status(201).json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar link externo.' });
  }
}

async function atualizarLinkExterno(req, res) {
  try {
    const link = await configService.atualizarLinkExterno(req.params.id, req.body);

    if (!link) {
      return res.status(404).json({ message: 'Link externo nao encontrado.' });
    }

    return res.json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar link externo.' });
  }
}

async function excluirLinkExterno(req, res) {
  try {
    const totalExcluido = await configService.excluirLinkExterno(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Link externo nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir link externo.' });
  }
}

module.exports = {
  operadoras,
  linksExternos,
  tiposProduto,
  tiposVenda,
  servicos,
  adminOperadoras,
  criarOperadora,
  atualizarOperadora,
  excluirOperadora,
  adminTiposProduto,
  criarTipoProduto,
  atualizarTipoProduto,
  excluirTipoProduto,
  adminTiposVenda,
  criarTipoVenda,
  atualizarTipoVenda,
  excluirTipoVenda,
  adminServicos,
  criarServico,
  atualizarServico,
  excluirServico,
  adminLinksExternos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
