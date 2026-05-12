const leadPlanilhaService = require('../services/lead-planilha.service');

async function index(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarPlanilhas());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar planilhas de leads.' });
  }
}

async function store(req, res) {
  try {
    const planilha = await leadPlanilhaService.criarPlanilha(req.body, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao criar planilha.' });
  }
}

async function upload(req, res) {
  try {
    const planilha = await leadPlanilhaService.iniciarUpload(req, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao iniciar upload.' });
  }
}

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

async function storeLinhas(req, res) {
  try {
    const resultado = await leadPlanilhaService.salvarLinhasLote(req.params.id, req.body.linhas || []);
    return res.status(201).json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao salvar linhas da planilha.' });
  }
}

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

async function linhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar linhas de leads.' });
  }
}

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

async function dividir(req, res) {
  try {
    return res.json(await leadPlanilhaService.dividirLeads(req.body, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao dividir leads.' });
  }
}

async function envios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarTodosEnvios());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar envios.' });
  }
}

async function meusEnvios(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarEnviosDoUsuario(req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar leads recebidos.' });
  }
}

async function minhasLinhas(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarLinhas(req.query, { usuarioId: req.usuario.id }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar leads recebidos.' });
  }
}

async function atualizarMeuCampo(req, res) {
  try {
    return res.json(await leadPlanilhaService.atualizarCampoLinhaRecebida(req.params.id, req.usuario.id, req.body || {}));
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao atualizar lead recebido.' });
  }
}

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

async function marcarFuturoCliente(req, res) {
  try {
    return res.json(await leadPlanilhaService.marcarComoFuturoCliente(req.params.id, req.usuario.id, req.body || {}));
  } catch (error) {
    console.error(error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || 'Erro ao marcar futuro cliente.' });
  }
}

async function listarFuturosClientes(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarFuturosClientes(req.query, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar futuros clientes.' });
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
  listarFuturosClientes
};
