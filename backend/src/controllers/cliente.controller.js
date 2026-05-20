const clienteService = require('../services/cliente.service');

async function index(req, res) {
  try {
    const clientes = await clienteService.listarClientes(req.query, req.usuario.id);

    return res.json(clientes);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar clientes.'
    });
  }
}

async function show(req, res) {
  try {
    const cliente = await clienteService.buscarClientePorId(req.params.id, req.usuario.id);

    if (!cliente) {
      return res.status(404).json({
        message: 'Cliente não encontrado.'
      });
    }

    return res.json(cliente);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao buscar cliente.'
    });
  }
}

async function select(req, res) {
  try {
    const clientes = await clienteService.listarClientesSelect(req.query, req.usuario.id);
    return res.json(clientes);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar clientes para selecao.'
    });
  }
}

async function store(req, res) {
  try {
    const cliente = await clienteService.criarCliente(req.body, req.usuario.id);
    const clienteCompleto = await clienteService.buscarClientePorId(cliente.id, req.usuario.id);

    return res.status(201).json(clienteCompleto);
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao criar cliente.'
    });
  }
}

async function previewImportacaoBaseAnterior(req, res) {
  try {
    const preview = await clienteService.previewImportacaoBaseAnterior(req);
    return res.json(preview);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao ler planilha.'
    });
  }
}

async function importarBaseAnterior(req, res) {
  try {
    const resultado = await clienteService.importarBaseAnterior(req, req.usuario.id);
    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({
      message: error.message || 'Erro ao importar base anterior.'
    });
  }
}

async function update(req, res) {
  try {
    const cliente = await clienteService.atualizarCliente(req.params.id, req.body, req.usuario.id);

    if (!cliente) {
      return res.status(404).json({
        message: 'Cliente não encontrado.'
      });
    }

    const clienteCompleto = await clienteService.buscarClientePorId(req.params.id, req.usuario.id);

    return res.json(clienteCompleto);
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      message: error.message || 'Erro ao atualizar cliente.'
    });
  }
}

async function destroy(req, res) {
  try {
    const totalExcluido = await clienteService.excluirCliente(req.params.id, req.usuario.id);

    if (!totalExcluido) {
      return res.status(404).json({
        message: 'Cliente não encontrado.'
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao excluir cliente.'
    });
  }
}

async function lixeira(req, res) {
  try {
    const clientes = await clienteService.listarClientesLixeira(req.query, req.usuario.id);

    return res.json(clientes);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao listar lixeira de clientes.'
    });
  }
}

async function restore(req, res) {
  try {
    const cliente = await clienteService.restaurarCliente(req.params.id, req.usuario.id);

    if (!cliente) {
      return res.status(404).json({
        message: 'Cliente não encontrado na lixeira.'
      });
    }

    return res.json(cliente);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: 'Erro ao restaurar cliente.'
    });
  }
}

async function destroyDefinitivo(req, res) {
  try {
    const excluirVendasRelacionadas = ['1', 'true', true, 1].includes(
      req.query.excluir_vendas_relacionadas ?? req.body?.excluir_vendas_relacionadas
    );
    const totalExcluido = await clienteService.excluirClienteDefinitivo(req.params.id, req.usuario.id, {
      excluirVendasRelacionadas
    });

    if (!totalExcluido) {
      return res.status(404).json({
        message: 'Cliente não encontrado na lixeira.'
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao excluir cliente definitivamente.',
      total_vendas_relacionadas: error.totalVendasRelacionadas
    });
  }
}

async function limparBaseAnterior(req, res) {
  try {
    const excluirVendasRelacionadas = ['1', 'true', true, 1].includes(
      req.query.excluir_vendas_relacionadas ?? req.body?.excluir_vendas_relacionadas
    );
    const resultado = await clienteService.limparClientesBaseAnterior({
      excluirVendasRelacionadas
    });
    return res.json(resultado);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message || 'Erro ao limpar clientes da base anterior.'
    });
  }
}

module.exports = {
  index,
  select,
  show,
  store,
  previewImportacaoBaseAnterior,
  importarBaseAnterior,
  update,
  destroy,
  lixeira,
  restore,
  destroyDefinitivo,
  limparBaseAnterior
};
