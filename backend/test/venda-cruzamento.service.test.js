const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cruzar,
  indexarOperadora,
  aplicarTipoMap,
  normalizarChave
} = require('../src/services/venda-cruzamento.service');

const config = {
  principal: {
    razaoSocial: 'Razao Social',
    operadora: 'Operadora',
    data: 'Data',
    colunasResultado: ['Razao Social', 'Operadora', 'Cliente']
  },
  claro: { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo', INCREMENTO: 'Base' } },
  vivo: { razaoSocial: 'Razao Social', tipo: 'BASE/FRESH', valorOperadora: 'vivo', tipoMap: { FRESH: 'Novo', BASE: 'Base' } }
};

function indices(linhasClaro = [], linhasVivo = []) {
  return [
    indexarOperadora(linhasClaro, config.claro),
    indexarOperadora(linhasVivo, config.vivo)
  ];
}

test('normalizarChave remove acento, ignora caixa e colapsa espacos', () => {
  assert.equal(normalizarChave('  Empresa   ÁGIL  Ltda '), 'empresa agil ltda');
  assert.equal(normalizarChave('EMPRESA AGIL LTDA'), 'empresa agil ltda');
});

test('aplicarTipoMap respeita o mapa e ignora caixa/acento', () => {
  assert.equal(aplicarTipoMap({ NOVO: 'Novo' }, 'novo'), 'Novo');
  assert.equal(aplicarTipoMap({ FRESH: 'Novo' }, 'FRESH'), 'Novo');
  assert.equal(aplicarTipoMap({ NOVO: 'Novo' }, 'DESCONHECIDO'), 'DESCONHECIDO');
});

test('Claro NOVO vira concluida com Tipo Novo', () => {
  const [claro, vivo] = indices([{ 'Razao Social': 'Empresa A', Tipo: 'NOVO' }], []);
  const principal = [{ 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'A', Data: '2026-01-01' }];
  const { concluidas, naoConcluidas } = cruzar(principal, claro, vivo, config);
  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 0);
  assert.equal(concluidas[0].Tipo, 'Novo');
});

test('Vivo FRESH->Novo e BASE->Base', () => {
  const [claro, vivo] = indices([], [
    { 'Razao Social': 'Empresa B', 'BASE/FRESH': 'FRESH' },
    { 'Razao Social': 'Empresa C', 'BASE/FRESH': 'BASE' }
  ]);
  const principal = [
    { 'Razao Social': 'Empresa B', Operadora: 'Vivo', Cliente: 'B', Data: '2026-01-01' },
    { 'Razao Social': 'Empresa C', Operadora: 'Vivo', Cliente: 'C', Data: '2026-01-01' }
  ];
  const { concluidas } = cruzar(principal, claro, vivo, config);
  const porEmpresa = Object.fromEntries(concluidas.map(item => [item['Razao Social'], item.Tipo]));
  assert.equal(porEmpresa['Empresa B'], 'Novo');
  assert.equal(porEmpresa['Empresa C'], 'Base');
});

test('venda refeita com uma concluida mantem so a concluida', () => {
  const [claro, vivo] = indices([{ 'Razao Social': 'Empresa D', Tipo: 'NOVO' }], []);
  const principal = [
    { 'Razao Social': 'Empresa D', Operadora: 'Claro', Cliente: 'antiga', Data: '2026-01-01' },
    { 'Razao Social': 'Empresa D', Operadora: 'Claro', Cliente: 'refeita', Data: '2026-02-01' }
  ];
  const { concluidas, naoConcluidas } = cruzar(principal, claro, vivo, config);
  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 0);
});

test('venda refeita sem concluida mantem a mais recente em nao concluidas', () => {
  const [claro, vivo] = indices([], []);
  const principal = [
    { 'Razao Social': 'Empresa E', Operadora: 'Claro', Cliente: 'antiga', Data: '2026-01-01' },
    { 'Razao Social': 'Empresa E', Operadora: 'Claro', Cliente: 'recente', Data: '2026-03-01' }
  ];
  const { concluidas, naoConcluidas } = cruzar(principal, claro, vivo, config);
  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 1);
  assert.equal(naoConcluidas[0].Cliente, 'recente');
  assert.equal(naoConcluidas[0].Tipo, '');
});

test('Razao Social ausente nas operadoras vai para nao concluidas', () => {
  const [claro, vivo] = indices([{ 'Razao Social': 'Empresa A', Tipo: 'NOVO' }], []);
  const principal = [{ 'Razao Social': 'Empresa Sem Match', Operadora: 'Claro', Cliente: 'X', Data: '2026-01-01' }];
  const { concluidas, naoConcluidas } = cruzar(principal, claro, vivo, config);
  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 1);
});

test('Razao Social com caixa/acento/espaco diferente casa mesmo assim', () => {
  const [claro, vivo] = indices([{ 'Razao Social': 'EMPRESA ÁGIL LTDA', Tipo: 'INCREMENTO' }], []);
  const principal = [{ 'Razao Social': '  empresa agil   ltda ', Operadora: 'Claro', Cliente: 'Y', Data: '2026-01-01' }];
  const { concluidas } = cruzar(principal, claro, vivo, config);
  assert.equal(concluidas.length, 1);
  assert.equal(concluidas[0].Tipo, 'Base');
});

test('tipoMap customizado pela config e respeitado', () => {
  const configCustom = {
    ...config,
    claro: { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { PORTABILIDADE: 'Novo' } }
  };
  const claro = indexarOperadora([{ 'Razao Social': 'Empresa Z', Tipo: 'PORTABILIDADE' }], configCustom.claro);
  const vivo = indexarOperadora([], configCustom.vivo);
  const principal = [{ 'Razao Social': 'Empresa Z', Operadora: 'Claro', Cliente: 'Z', Data: '2026-01-01' }];
  const { concluidas } = cruzar(principal, claro, vivo, configCustom);
  assert.equal(concluidas[0].Tipo, 'Novo');
});
