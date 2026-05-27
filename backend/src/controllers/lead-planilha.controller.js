/**
 * Controller HTTP de planilhas de leads.
 *
 * Coordena upload, processamento, divisao, exportacao e fluxo de futuros
 * clientes originados das linhas importadas.
 */
const leadPlanilhaService = require('../services/lead-planilha.service');

/**
 * Executa a rotina index.
 */
async function index(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarPlanilhas());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar planilhas de mailing.' });
  }
}

/**
 * Executa a rotina store.
 */
async function store(req, res) {
  try {
    const planilha = await leadPlanilhaService.criarPlanilha(req.body, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar planilha.' });
  }
}

/**
 * Executa a rotina upload.
 */
async function upload(req, res) {
  try {
    const planilha = await leadPlanilhaService.iniciarUpload(req, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao iniciar upload.' });
  }
}

/**
 * Executa a rotina status.
 */
async function status(req, res) {
  try {
    const planilha = await leadPlanilhaService.buscarStatus(req.params.id);

    if (!planilha) {
      return res.status(404).json({ message: 'Planilha não encontrada.' });
    }

    return res.json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao consultar status da planilha.' });
  }
}

/**
 * Executa a rotina store linhas.
 */
async function storeLinhas(req, res) {
  try {
    const resultado = await leadPlanilhaService.salvarLinhasLote(req.params.id, req.body.linhas || []);
    return res.status(201).json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao salvar linhas da planilha.' });
  }
}

/**
 * Executa a rotina finalizar.
 */
async function finalizar(req, res) {
  try {
    const planilha = await leadPlanilhaService.finalizarPlanilha(req.params.id, req.body || {});
    return res.json(planilha);
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao finalizar planilha.' });
  }
}

/**
 * Executa a rotina erro.
 */
async function erro(req, res) {
  try {
    const planilha = await leadPlanilhaService.marcarErroPlanilha(req.params.id, req.body?.message || req.body?.mensagem);
    return res.json(planilha);
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao marcar erro da planilha.' });
  }
}

/**
 * Executa a rotina update schema.
 */
async function updateSchema(req, res) {
  try {
    const planilha = await leadPlanilhaService.atualizarSchema(req.params.id, req.body.schema_colunas);

    if (!planilha) {
      return res.status(404).json({ message: 'Planilha não encontrada.' });
    }

    return res.json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao atualizar schema.' });
  }
}

/**
 * Executa a rotina destroy.
 */
async function destroy(req, res) {
  try {
    await leadPlanilhaService.excluirPlanilha(req.params.id);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || 'Erro ao excluir planilha.'
    });
  }
}

/**
 * Executa a rotina linhas.
 */
async function linhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar linhas de mailing.' });
  }
}

/**
 * Executa a rotina exportar.
 */
async function exportar(req, res) {
  try {
    await leadPlanilhaService.exportarCsv(req.body || {}, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Erro ao exportar CSV.' });
    }
    return res.end();
  }
}

/**
 * Executa a rotina dividir.
 */
async function dividir(req, res) {
  try {
    return res.json(await leadPlanilhaService.dividirLeads(req.body, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao dividir mailing.' });
  }
}

/**
 * Executa a rotina envios.
 */
async function envios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarTodosEnvios());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar envios.' });
  }
}

/**
 * Executa a rotina meus envios.
 */
async function meusEnvios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarEnviosDoUsuario(req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar mailing recebido.' });
  }
}

/**
 * Executa a rotina minhas linhas.
 */
async function minhasLinhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query, { usuarioId: req.usuario.id }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar mailing recebido.' });
  }
}

/**
 * Executa a rotina atualizar meu campo.
 */
async function atualizarMeuCampo(req, res) {
  try {
    return res.json(await leadPlanilhaService.atualizarCampoLinhaRecebida(req.params.id, req.usuario.id, req.body || {}));
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao atualizar lead recebido.' });
  }
}

/**
 * Executa a rotina exportar minhas.
 */
async function exportarMinhas(req, res) {
  try {
    await leadPlanilhaService.exportarCsv(req.body || {}, res, { usuarioId: req.usuario.id });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Erro ao exportar CSV.' });
    }
    return res.end();
  }
}

/**
 * Executa a rotina marcar futuro cliente.
 */
async function marcarFuturoCliente(req, res) {
  try {
    return res.json(await leadPlanilhaService.marcarComoFuturoCliente(req.params.id, req.usuario.id, req.body || {}));
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao marcar futuro cliente.' });
  }
}

/**
 * Executa a rotina listar futuros clientes.
 */
async function listarFuturosClientes(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarFuturosClientes(req.query, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar futuros clientes.' });
  }
}

/**
 * Executa a rotina listar futuros clientes lixeira.
 */
async function listarFuturosClientesLixeira(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarFuturosClientesLixeira(req.query, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar lixeira de futuros clientes.' });
  }
}

/**
 * Executa a rotina excluir futuro cliente.
 */
async function excluirFuturoCliente(req, res) {
  try {
    const total = await leadPlanilhaService.enviarFuturoClienteParaLixeira(req.params.id, req.usuario.id);

    if (!total) {
      return res.status(404).json({ message: 'Futuro cliente não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Erro ao enviar futuro cliente para lixeira.' });
  }
}

/**
 * Executa a rotina restaurar futuro cliente.
 */
async function restaurarFuturoCliente(req, res) {
  try {
    const linha = await leadPlanilhaService.restaurarFuturoCliente(req.params.id, req.usuario.id);

    if (!linha) {
      return res.status(404).json({ message: 'Futuro cliente não encontrado na lixeira.' });
    }

    return res.json(linha);
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Erro ao restaurar futuro cliente.' });
  }
}

/**
 * Executa a rotina excluir futuro cliente definitivo.
 */
async function excluirFuturoClienteDefinitivo(req, res) {
  try {
    const total = await leadPlanilhaService.excluirFuturoClienteDefinitivo(req.params.id, req.usuario.id);

    if (!total) {
      return res.status(404).json({ message: 'Futuro cliente não encontrado na lixeira.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || 'Erro ao excluir futuro cliente definitivamente.' });
  }
}

module.exports = {
  index,
  store,
  upload,
  status,
  storeLinhas,
  finalizar,
  erro,
  updateSchema,
  destroy,
  linhas,
  exportar,
  dividir,
  envios,
  meusEnvios,
  minhasLinhas,
  atualizarMeuCampo,
  exportarMinhas,
  marcarFuturoCliente,
  listarFuturosClientes,
  listarFuturosClientesLixeira,
  excluirFuturoCliente,
  restaurarFuturoCliente,
  excluirFuturoClienteDefinitivo
};
