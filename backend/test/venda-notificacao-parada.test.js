const test = require('node:test');
const assert = require('node:assert/strict');

const vendaNotificacaoParadaService = require('../src/services/venda-notificacao-parada.service');

test('calcula horas decorridas entre entrada e data de referencia', () => {
  const dataInicio = new Date('2026-05-01T00:00:00Z');

  assert.equal(
    vendaNotificacaoParadaService.horasDecorridas(dataInicio, new Date('2026-05-05T23:00:00Z')),
    119
  );
  assert.equal(
    vendaNotificacaoParadaService.horasDecorridas(dataInicio, new Date('2026-05-06T00:00:00Z')),
    120
  );
  assert.equal(
    vendaNotificacaoParadaService.horasDecorridas(dataInicio, new Date('2026-05-06T01:00:00Z')),
    121
  );
});

test('usa 120 horas como limite de venda parada', () => {
  assert.equal(vendaNotificacaoParadaService.HORAS_LIMITE, 120);

  const dataInicio = new Date('2026-05-01T00:00:00Z');
  const antesDoLimite = vendaNotificacaoParadaService.horasDecorridas(
    dataInicio,
    new Date('2026-05-05T23:00:00Z')
  );
  const noLimite = vendaNotificacaoParadaService.horasDecorridas(
    dataInicio,
    new Date('2026-05-06T00:00:00Z')
  );

  assert.equal(antesDoLimite < vendaNotificacaoParadaService.HORAS_LIMITE, true);
  assert.equal(noLimite >= vendaNotificacaoParadaService.HORAS_LIMITE, true);
});
