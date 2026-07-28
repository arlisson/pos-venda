function autoMigrateAtivo(valor = process.env.AUTO_MIGRATE) {
  return String(valor || '').trim().toLowerCase() === 'true';
}

async function executarMigracoesAutomaticas(db, options = {}) {
  const {
    valor = process.env.AUTO_MIGRATE,
    logger = console
  } = options;

  if (!autoMigrateAtivo(valor)) {
    return [];
  }

  logger.info('AUTO_MIGRATE ativo: verificando migrations pendentes...');

  const [, migrations] = await db.migrate.latest();

  if (migrations.length === 0) {
    logger.info('Banco de dados sem migrations pendentes.');
  } else {
    logger.info(`Migrations executadas: ${migrations.join(', ')}`);
  }

  return migrations;
}

function abrirServidor(app, port, logger = console) {
  return new Promise((resolve, reject) => {
    let server;

    const aoFalhar = error => {
      reject(error);
    };

    server = app.listen(port, () => {
      server.removeListener('error', aoFalhar);
      logger.info(`Servidor rodando em http://localhost:${port}`);
      resolve(server);
    });

    server.once('error', aoFalhar);
    server.requestTimeout = 30 * 60 * 1000;
    server.headersTimeout = 31 * 60 * 1000;
  });
}

async function iniciarAplicacao(options) {
  const {
    app,
    db,
    port,
    iniciarAgendamentos,
    logger = console,
    autoMigrate = process.env.AUTO_MIGRATE
  } = options;

  await executarMigracoesAutomaticas(db, {
    valor: autoMigrate,
    logger
  });

  const server = await abrirServidor(app, port, logger);
  iniciarAgendamentos();

  return server;
}

module.exports = {
  autoMigrateAtivo,
  executarMigracoesAutomaticas,
  abrirServidor,
  iniciarAplicacao
};
