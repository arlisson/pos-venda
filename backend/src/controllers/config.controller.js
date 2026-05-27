/**
 * Controller HTTP de configuracoes administrativas e listas auxiliares.
 *
 * Expoe operadoras, tipos de produto, tipos de venda, servicos, funil,
 * regras de comissao e links externos para telas publicas e administrativas.
 */
const configService = require('../services/config.service');

/**
 * Retorna operadoras no formato esperado pelo fluxo.
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
 * Processa links externos conforme as regras do dominio.
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
 * Retorna tipos produto no formato esperado pelo fluxo.
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
 * Retorna tipos venda no formato esperado pelo fluxo.
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
 * Processa servicos conforme as regras do dominio.
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
 * Processa funil etapas conforme as regras do dominio.
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
 * Retorna regras comissao no formato esperado pelo fluxo.
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
 * Processa admin operadoras conforme as regras do dominio.
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
 * Processa admin tipos produto conforme as regras do dominio.
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
 * Cria tipo produto com os dados informados.
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
 * Atualiza tipo produto com os dados informados.
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
 * Exclui tipo produto conforme a regra de negocio.
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
 * Processa admin tipos venda conforme as regras do dominio.
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
 * Cria tipo venda com os dados informados.
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
 * Atualiza tipo venda com os dados informados.
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
 * Exclui tipo venda conforme a regra de negocio.
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
 * Processa admin servicos conforme as regras do dominio.
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
 * Cria servico com os dados informados.
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
 * Atualiza servico com os dados informados.
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
 * Exclui servico conforme a regra de negocio.
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
 * Processa admin funil etapas conforme as regras do dominio.
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
 * Processa admin regras comissao conforme as regras do dominio.
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
 * Cria regra comissao com os dados informados.
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
 * Atualiza regra comissao com os dados informados.
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
 * Exclui regra comissao conforme a regra de negocio.
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
 * Cria funil etapa com os dados informados.
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
 * Atualiza funil etapa com os dados informados.
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
 * Processa reordenar funil etapas conforme as regras do dominio.
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
 * Exclui funil etapa conforme a regra de negocio.
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
 * Cria operadora com os dados informados.
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
 * Atualiza operadora com os dados informados.
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
 * Exclui operadora conforme a regra de negocio.
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
 * Processa admin links externos conforme as regras do dominio.
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
 * Cria link externo com os dados informados.
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
 * Atualiza link externo com os dados informados.
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
 * Exclui link externo conforme a regra de negocio.
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
