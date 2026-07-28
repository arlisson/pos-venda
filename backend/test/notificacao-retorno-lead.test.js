const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('../src/services/notificacao.service');

const { isRetornoLeadAgendadoElegivel } = _internals;

test('mantem retorno de mailing elegivel antes da qualificacao', () => {
  assert.equal(isRetornoLeadAgendadoElegivel({
    retorno_agendado_em: '2026-07-29 14:00:00',
    cliente_recusou: false,
    futuro_cliente: false,
    status_operacional: 'pendente'
  }), true);
});

test('permite retorno de futuro cliente encaminhado pelo Telegram', () => {
  assert.equal(isRetornoLeadAgendadoElegivel({
    retorno_agendado_em: '2026-07-29 14:00:00',
    cliente_recusou: false,
    futuro_cliente: true,
    status_operacional: 'distribuido_venda'
  }), true);
});

test('nao cria retorno de mailing para futuro cliente fora do encaminhamento', () => {
  assert.equal(isRetornoLeadAgendadoElegivel({
    retorno_agendado_em: '2026-07-29 14:00:00',
    cliente_recusou: false,
    futuro_cliente: true,
    status_operacional: 'qualificado'
  }), false);
});

test('nao cria retorno sem data ou depois de recusa do cliente', () => {
  assert.equal(isRetornoLeadAgendadoElegivel({
    retorno_agendado_em: null,
    cliente_recusou: false,
    futuro_cliente: false
  }), false);
  assert.equal(isRetornoLeadAgendadoElegivel({
    retorno_agendado_em: '2026-07-29 14:00:00',
    cliente_recusou: true,
    futuro_cliente: false
  }), false);
});
