/**
 * Controller HTTP de configuracoes administrativas e listas auxiliares.
 *
 * Expoe operadoras, tipos de produto, tipos de venda, servicos, funil,
 * regras de comissao e links externos para telas publicas e administrativas.
 */
const configService = require('../services/config.service');

/**
 * Executa a rotina operadoras.
 */
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

/**
 * Executa a rotina links externos.
 */
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

/**
 * Executa a rotina tipos produto.
 */
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

/**
 * Executa a rotina tipos venda.
 */
async function tiposVenda(req, res) {
  try {
    const dados = await configService.listarTiposVendaAtivos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de venda.' });
  }
}

/**
 * Executa a rotina servicos.
 */
async function servicos(req, res) {
  try {
    const dados = await configService.listarServicosAtivos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar servicos.' });
  }
}

/**
 * Executa a rotina funil etapas.
 */
async function funilEtapas(req, res) {
  try {
    const dados = await configService.listarFunilEtapas();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar etapas do funil.' });
  }
}

/**
 * Executa a rotina regras comissao.
 */
async function regrasComissao(req, res) {
  try {
    const dados = await configService.listarRegrasComissaoAtivas();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar regras de comissao.' });
  }
}

/**
 * Executa a rotina admin operadoras.
 */
async function adminOperadoras(req, res) {
  try {
    const dados = await configService.listarOperadoras();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar operadoras.' });
  }
}

/**
 * Executa a rotina admin tipos produto.
 */
async function adminTiposProduto(req, res) {
  try {
    const dados = await configService.listarTiposProduto();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de produto.' });
  }
}

/**
 * Executa a rotina criar tipo produto.
 */
async function criarTipoProduto(req, res) {
  try {
    const tipoProduto = await configService.criarTipoProduto(req.body);
    return res.status(201).json(tipoProduto);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar tipo de produto.' });
  }
}

/**
 * Executa a rotina atualizar tipo produto.
 */
async function atualizarTipoProduto(req, res) {
  try {
    const tipoProduto = await configService.atualizarTipoProduto(req.params.id, req.body);

    if (!tipoProduto) {
      return res.status(404).json({ message: 'Tipo de produto não encontrado.' });
    }

    return res.json(tipoProduto);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar tipo de produto.' });
  }
}

/**
 * Executa a rotina excluir tipo produto.
 */
async function excluirTipoProduto(req, res) {
  try {
    const totalExcluido = await configService.excluirTipoProduto(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Tipo de produto não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir tipo de produto.' });
  }
}

/**
 * Executa a rotina admin tipos venda.
 */
async function adminTiposVenda(req, res) {
  try {
    const dados = await configService.listarTiposVenda();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar tipos de venda.' });
  }
}

/**
 * Executa a rotina criar tipo venda.
 */
async function criarTipoVenda(req, res) {
  try {
    const tipoVenda = await configService.criarTipoVenda(req.body);
    return res.status(201).json(tipoVenda);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar tipo de venda.' });
  }
}

/**
 * Executa a rotina atualizar tipo venda.
 */
async function atualizarTipoVenda(req, res) {
  try {
    const tipoVenda = await configService.atualizarTipoVenda(req.params.id, req.body);

    if (!tipoVenda) {
      return res.status(404).json({ message: 'Tipo de venda não encontrado.' });
    }

    return res.json(tipoVenda);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar tipo de venda.' });
  }
}

/**
 * Executa a rotina excluir tipo venda.
 */
async function excluirTipoVenda(req, res) {
  try {
    const totalExcluido = await configService.excluirTipoVenda(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Tipo de venda não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir tipo de venda.' });
  }
}

/**
 * Executa a rotina admin servicos.
 */
async function adminServicos(req, res) {
  try {
    const dados = await configService.listarServicos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar servicos.' });
  }
}

/**
 * Executa a rotina criar servico.
 */
async function criarServico(req, res) {
  try {
    const servico = await configService.criarServico(req.body);
    return res.status(201).json(servico);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar serviço.' });
  }
}

/**
 * Executa a rotina atualizar servico.
 */
async function atualizarServico(req, res) {
  try {
    const servico = await configService.atualizarServico(req.params.id, req.body);

    if (!servico) {
      return res.status(404).json({ message: 'Serviço não encontrado.' });
    }

    return res.json(servico);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar serviço.' });
  }
}

/**
 * Executa a rotina excluir servico.
 */
async function excluirServico(req, res) {
  try {
    const totalExcluido = await configService.excluirServico(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Serviço não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir serviço.' });
  }
}

/**
 * Executa a rotina admin funil etapas.
 */
async function adminFunilEtapas(req, res) {
  try {
    const dados = await configService.listarFunilEtapas();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar etapas do funil.' });
  }
}

/**
 * Executa a rotina admin regras comissao.
 */
async function adminRegrasComissao(req, res) {
  try {
    const dados = await configService.listarRegrasComissao();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar regras de comissao.' });
  }
}

/**
 * Executa a rotina criar regra comissao.
 */
async function criarRegraComissao(req, res) {
  try {
    const regra = await configService.criarRegraComissao(req.body);
    return res.status(201).json(regra);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar regra de comissao.' });
  }
}

/**
 * Executa a rotina atualizar regra comissao.
 */
async function atualizarRegraComissao(req, res) {
  try {
    const regra = await configService.atualizarRegraComissao(req.params.id, req.body);

    if (!regra) {
      return res.status(404).json({ message: 'Regra de comissao nao encontrada.' });
    }

    return res.json(regra);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao atualizar regra de comissao.' });
  }
}

/**
 * Executa a rotina excluir regra comissao.
 */
async function excluirRegraComissao(req, res) {
  try {
    const totalExcluido = await configService.excluirRegraComissao(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Regra de comissao nao encontrada.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir regra de comissao.' });
  }
}

/**
 * Executa a rotina criar funil etapa.
 */
async function criarFunilEtapa(req, res) {
  try {
    const etapa = await configService.criarFunilEtapa(req.body);
    return res.status(201).json(etapa);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar etapa do funil.' });
  }
}

/**
 * Executa a rotina atualizar funil etapa.
 */
async function atualizarFunilEtapa(req, res) {
  try {
    const etapa = await configService.atualizarFunilEtapa(req.params.id, req.body);

    if (!etapa) {
      return res.status(404).json({ message: 'Etapa do funil não encontrada.' });
    }

    return res.json(etapa);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao atualizar etapa do funil.' });
  }
}

/**
 * Executa a rotina reordenar funil etapas.
 */
async function reordenarFunilEtapas(req, res) {
  try {
    await configService.reordenarFunilEtapas(req.body.ordens);
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao reordenar etapas do funil.' });
  }
}

/**
 * Executa a rotina excluir funil etapa.
 */
async function excluirFunilEtapa(req, res) {
  try {
    const resultado = await configService.excluirFunilEtapa(req.params.id);

    if (!resultado) {
      return res.status(404).json({ message: 'Etapa do funil nao encontrada.' });
    }

    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir etapa do funil.' });
  }
}

/**
 * Executa a rotina criar operadora.
 */
async function criarOperadora(req, res) {
  try {
    const operadora = await configService.criarOperadora(req.body);
    return res.status(201).json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar operadora.' });
  }
}

/**
 * Executa a rotina atualizar operadora.
 */
async function atualizarOperadora(req, res) {
  try {
    const operadora = await configService.atualizarOperadora(req.params.id, req.body);

    if (!operadora) {
      return res.status(404).json({ message: 'Operadora não encontrada.' });
    }

    return res.json(operadora);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar operadora.' });
  }
}

/**
 * Executa a rotina excluir operadora.
 */
async function excluirOperadora(req, res) {
  try {
    const totalExcluido = await configService.excluirOperadora(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Operadora não encontrada.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao excluir operadora.' });
  }
}

/**
 * Executa a rotina admin links externos.
 */
async function adminLinksExternos(req, res) {
  try {
    const dados = await configService.listarLinksExternos();
    return res.json(dados);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar links externos.' });
  }
}

/**
 * Executa a rotina criar link externo.
 */
async function criarLinkExterno(req, res) {
  try {
    const link = await configService.criarLinkExterno(req.body);
    return res.status(201).json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao criar link externo.' });
  }
}

/**
 * Executa a rotina atualizar link externo.
 */
async function atualizarLinkExterno(req, res) {
  try {
    const link = await configService.atualizarLinkExterno(req.params.id, req.body);

    if (!link) {
      return res.status(404).json({ message: 'Link externo não encontrado.' });
    }

    return res.json(link);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar link externo.' });
  }
}

/**
 * Executa a rotina excluir link externo.
 */
async function excluirLinkExterno(req, res) {
  try {
    const totalExcluido = await configService.excluirLinkExterno(req.params.id);

    if (!totalExcluido) {
      return res.status(404).json({ message: 'Link externo não encontrado.' });
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
  funilEtapas,
  regrasComissao,
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
  adminFunilEtapas,
  criarFunilEtapa,
  atualizarFunilEtapa,
  excluirFunilEtapa,
  reordenarFunilEtapas,
  adminRegrasComissao,
  criarRegraComissao,
  atualizarRegraComissao,
  excluirRegraComissao,
  adminLinksExternos,
  criarLinkExterno,
  atualizarLinkExterno,
  excluirLinkExterno
};
