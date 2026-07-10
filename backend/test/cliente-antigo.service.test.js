const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('../src/services/cliente-antigo.service');

test('gera chaves diferentes para vendas do mesmo CNPJ em linhas diferentes', () => {
  const classificacao = { tipo: 'cnpj', digitos: '11222333000181' };

  const primeira = _internals.montarChaveLinha('base.xlsx', 'Janeiro', 2, classificacao, 'Empresa Teste', '2026-01-10');
  const segunda = _internals.montarChaveLinha('base.xlsx', 'Janeiro', 3, classificacao, 'Empresa Teste', '2026-01-10');

  assert.notEqual(primeira, segunda);
  assert.match(primeira, /^linha:[a-f0-9]{40}$/);
});

test('parseia quantidade de chips da importacao antiga', () => {
  assert.equal(_internals.parseQuantidadeChips('3'), 3);
  assert.equal(_internals.parseQuantidadeChips('2,0'), 2);
  assert.equal(_internals.parseQuantidadeChips(' 5 chips '), 5);
  assert.equal(_internals.parseQuantidadeChips(''), null);
  assert.equal(_internals.parseQuantidadeChips('-1'), null);
});

test('formata telefone do cliente do sistema usando whatsapp antes do fixo', () => {
  assert.equal(_internals.formatarTelefoneClienteSistema({
    whatsapp_ddd: '84',
    whatsapp_numero: '999998888',
    fixo_ddd: '84',
    fixo_numero: '33332222'
  }), '84999998888');
  assert.equal(_internals.formatarTelefoneClienteSistema({
    fixo_ddd: '84',
    fixo_numero: '33332222'
  }), '8433332222');
  assert.equal(_internals.formatarTelefoneClienteSistema({}), null);
});test('calcula fidelidade 24 meses apos a data da venda antiga', () => {
  assert.equal(_internals.adicionarMesesDataISO('2022-05-10', 24), '2024-05-10');
  assert.equal(_internals.adicionarMesesDataISO('2024-02-29', 24), '2026-02-28');
  assert.equal(_internals.adicionarMesesDataISO('2023-01-31', 1), '2023-02-28');
  assert.equal(_internals.adicionarMesesDataISO('', 24), null);
});