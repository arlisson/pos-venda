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
        message: 'Cliente nao encontrado.'
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

async function update(req, res) {
  try {
    const cliente = await clienteService.atualizarCliente(req.params.id, req.body, req.usuario.id);

    if (!cliente) {
      return res.status(404).json({
        message: 'Cliente nao encontrado.'
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
        message: 'Cliente nao encontrado.'
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

module.exports = {
  index,
  show,
  store,
  update,
  destroy
};
