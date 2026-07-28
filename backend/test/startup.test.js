const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  autoMigrateAtivo,
  iniciarAplicacao
} = require('../src/startup');

function criarAppFake(eventos) {
  const server = new EventEmitter();

  return {
    server,
    app: {
      listen: (port, callback) => {
        eventos.push(`listen:${port}`);
        setImmediate(callback);
        return server;
      }
    }
  };
}

const logger = {
  info: () => {}
};

test('AUTO_MIGRATE aceita somente o valor true', () => {
  assert.equal(autoMigrateAtivo('true'), true);
  assert.equal(autoMigrateAtivo(' TRUE '), true);
  assert.equal(autoMigrateAtivo('false'), false);
  assert.equal(autoMigrateAtivo(undefined), false);
});

test('executa migration, abre a API e depois inicia os agendamentos', async () => {
  const eventos = [];
  const { app, server } = criarAppFake(eventos);
  const db = {
    migrate: {
      latest: async () => {
        eventos.push('migrate');
        return [1, ['001_migration.js']];
      }
    }
  };

  const resultado = await iniciarAplicacao({
    app,
    db,
    port: 3000,
    iniciarAgendamentos: () => eventos.push('agendamentos'),
    logger,
    autoMigrate: 'true'
  });

  assert.equal(resultado, server);
  assert.deepEqual(eventos, ['migrate', 'listen:3000', 'agendamentos']);
  assert.equal(server.requestTimeout, 30 * 60 * 1000);
  assert.equal(server.headersTimeout, 31 * 60 * 1000);
});

test('mantem a inicializacao normal quando AUTO_MIGRATE esta desativado', async () => {
  const eventos = [];
  const { app } = criarAppFake(eventos);
  const db = {
    migrate: {
      latest: async () => {
        throw new Error('nao deveria executar');
      }
    }
  };

  await iniciarAplicacao({
    app,
    db,
    port: 3000,
    iniciarAgendamentos: () => eventos.push('agendamentos'),
    logger,
    autoMigrate: 'false'
  });

  assert.deepEqual(eventos, ['listen:3000', 'agendamentos']);
});

test('nao abre a API nem inicia agendamentos se a migration falhar', async () => {
  const eventos = [];
  const { app } = criarAppFake(eventos);
  const erro = new Error('migration invalida');
  const db = {
    migrate: {
      latest: async () => {
        eventos.push('migrate');
        throw erro;
      }
    }
  };

  await assert.rejects(
    iniciarAplicacao({
      app,
      db,
      port: 3000,
      iniciarAgendamentos: () => eventos.push('agendamentos'),
      logger,
      autoMigrate: 'true'
    }),
    erro
  );

  assert.deepEqual(eventos, ['migrate']);
});
