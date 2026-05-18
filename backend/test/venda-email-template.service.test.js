const test = require('node:test');
const assert = require('node:assert/strict');

const { renderEmailVenda, _internals } = require('../src/services/venda-email-template.service');

const { parseItensChips, parsePortados, resolverOperadora } = _internals;

test('resolve operadoras com template disponivel', () => {
  assert.equal(resolverOperadora({ operadora: { nome: 'Claro Empresas' } }), 'Claro');
  assert.equal(resolverOperadora({ operadora: { nome: 'Vivo Empresas' } }), 'Vivo');
  assert.equal(resolverOperadora({ operadora: { nome: 'Outra' } }), null);
});

test('parseia chips e numeros portados para template', () => {
  assert.deepEqual(parseItensChips(JSON.stringify([
    { quantidade: 2, gb: '25', tipo_linha: 'Portabilidade', valor_unitario: '59.90' }
  ]), '10'), [
    { quantidade: 2, gb: '25', tipoLinha: 'portabilidade', valorUnitario: 59.9 }
  ]);

  assert.deepEqual(parseItensChips('2x49,90 / 1 x 39.90', '15'), [
    { quantidade: 2, gb: '15', tipoLinha: 'novo', valorUnitario: 49.9 },
    { quantidade: 1, gb: '15', tipoLinha: 'novo', valorUnitario: 39.9 }
  ]);

  assert.deepEqual(parsePortados('11999990000; 11888880000'), ['11999990000', '11888880000']);
});

test('renderiza template Claro com campos essenciais', () => {
  const resultado = renderEmailVenda({
    operadora: { nome: 'Claro' },
    vendedora: { nome: 'Ana' },
    razao_social: 'Cliente Claro LTDA',
    cnpj: '11.222.333/0001-81',
    quantidade_linhas: 2,
    valor_total: 119.8,
    valores_unitarios_chips: JSON.stringify([
      { quantidade: 2, gb: '25', tipo_linha: 'novo', valor_unitario: 59.9 }
    ]),
    ddd: '11',
    telefone: '+55 (11) 99999-0000',
    email_representante_legal: 'rl@test.local',
    nome_representante_legal: 'Responsavel Legal',
    numeros_portados: ''
  });

  assert.equal(resultado.operadora, 'Claro');
  assert.match(resultado.texto, /VENDA Ana - Cliente Claro LTDA/);
  assert.match(resultado.texto, /CNPJ: 11222333000181/);
  assert.match(resultado.texto, /CLARO/);
  assert.match(resultado.texto, /25GB/);
  assert.match(resultado.texto, /11999990000/);
});

test('renderiza template Vivo com linhas novas e portabilidade', () => {
  const resultado = renderEmailVenda({
    operadora: { nome: 'Vivo' },
    vendedora: { nome: 'Bia' },
    razao_social: 'Cliente Vivo LTDA',
    cnpj: '11222333000181',
    quantidade_linhas: 3,
    valor_total: 150,
    gb: '20',
    ddd: '21',
    numeros_portados: ['21999990000'],
    telefone: '2133334444',
    nome_fechou_venda: 'Maria'
  });

  assert.equal(resultado.operadora, 'Vivo');
  assert.match(resultado.texto, /VENDA Bia - Cliente Vivo LTDA/);
  assert.match(resultado.texto, /LINHA NOVA : 2x50,00/);
  assert.match(resultado.texto, /PORTABILIDADE : 1x50,00/);
  assert.match(resultado.texto, /VIVO 20GB - 3X50,00 - DDD 21/);
});

test('rejeita operadora sem template de email', () => {
  assert.throws(() => renderEmailVenda({
    operadora: { nome: 'Sem Template' }
  }), error => {
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /Operadora sem template/);
    return true;
  });
});
