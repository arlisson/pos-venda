/**
 * Controller HTTP de planilhas de leads.
 *
 * Coordena upload, processamento, divisao, exportacao e fluxo de futuros
 * clientes originados das linhas importadas.
 */
const leadPlanilhaService = require('../services/lead-planilha.service');

/**
 * Processa index conforme as regras do dominio.
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
 * Processa store conforme as regras do dominio.
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
 * Processa upload conforme as regras do dominio.
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
 * Importa uma planilha Excel de mailing.
 */
async function importarExcel(req, res) {
  try {
    const planilha = await leadPlanilhaService.importarExcel(req, req.usuario.id);
    return res.status(201).json(planilha);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao importar XLSX.' });
  }
}
/**
 * Importa o arquivo enviado somente para a base de clientes antigos.
 */
async function importarBaseAntiga(req, res) {
  try {
    const resultado = await leadPlanilhaService.importarBaseAntigaArquivo(req, req.usuario.id);
    return res.status(201).json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Erro ao importar base antiga.' });
  }
}
/**
 * Retorna status no formato esperado pelo fluxo.
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
 * Processa store linhas conforme as regras do dominio.
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
 * Processa finalizar conforme as regras do dominio.
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
 * Cria um erro HTTP com status e mensagem padronizados.
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
 * Atualiza schema com o estado mais recente.
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
 * Processa destroy conforme as regras do dominio.
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
 * Retorna linhas no formato esperado pelo fluxo.
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
 * Exporta  no formato esperado.
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
 * Processa dividir conforme as regras do dominio.
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
 * Processa envios conforme as regras do dominio.
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
 * Processa meus envios conforme as regras do dominio.
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
 * Processa minhas linhas conforme as regras do dominio.
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
 * Atualiza meu campo com os dados informados.
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
 * Exporta minhas no formato esperado.
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
 * Marca futuro cliente conforme a acao solicitada.
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
 * Lista futuros clientes conforme os filtros e parametros informados.
 */
async function listarFuturosClientes(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarFuturosClientes(req.query, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar futuros clientes.' });
  }
}

async function listarTodosFuturosClientes(req, res) {
  try {
    return res.json(await leadPlanilhaService.listarFuturosClientes(req.query, null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao listar o quadro de futuros clientes.' });
  }
}

async function metricasFuturosClientes(req, res) {
  try {
    return res.json(await leadPlanilhaService.obterMetricasFuturosClientes(req.query));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao calcular metricas de futuros clientes.' });
  }
}

/** Exporta a produtividade de primeira ligação em Excel. */
async function exportarMetricasFuturosClientes(req, res) {
  try {
    const { buffer, nome } = await leadPlanilhaService.gerarXlsxProdutividadePrimeiraLigacao(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    return res.send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Erro ao exportar a produtividade da primeira ligação.'
    });
  }
}

async function vincularVenda(req, res) {
  try {
    return res.json(await leadPlanilhaService.vincularVendaAoLead(req.params.id, req.body?.venda_id, req.usuario.id));
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({ message: error.message || 'Erro ao vincular venda ao lead.' });
  }
}

async function marcarVendaRecusada(req, res) {
  try {
    return res.json(await leadPlanilhaService.marcarVendaRecusadaLead(req.params.id, req.usuario.id, req.body || {}));
  } catch (error) {
    console.error(error);
    return res.status(error.statusCode || 400).json({ message: error.message || 'Erro ao marcar venda recusada.' });
  }
}

/**
 * Lista futuros clientes lixeira conforme os filtros e parametros informados.
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
 * Exclui futuro cliente conforme a regra de negocio.
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
 * Restaura futuro cliente quando a regra de negocio permite.
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
 * Exclui futuro cliente definitivo conforme a regra de negocio.
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
  importarExcel,
  importarBaseAntiga,
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
  listarTodosFuturosClientes,
  metricasFuturosClientes,
  exportarMetricasFuturosClientes,
  vincularVenda,
  marcarVendaRecusada,
  listarFuturosClientesLixeira,
  excluirFuturoCliente,
  restaurarFuturoCliente,
  excluirFuturoClienteDefinitivo
};
