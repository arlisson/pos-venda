const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cruzar,
  cruzarMultiplasPlanilhas,
  indexarOperadora,
  indexarConfirmacao,
  aplicarTipoMap,
  normalizarChave,
  classificarDocumento
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

test('cruza uma quantidade ilimitada de planilhas secundarias', () => {
  const configMultipla = {
    principal: { ...config.principal },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: {} },
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'vivo', tipoMap: {} },
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'tim', tipoMap: {} }
    ]
  };
  const indicesOperadoras = [
    indexarOperadora([{ 'Razao Social': 'Empresa A', Tipo: 'Novo' }], configMultipla.operadoras[0]),
    indexarOperadora([{ 'Razao Social': 'Empresa B', Tipo: 'Base' }], configMultipla.operadoras[1]),
    indexarOperadora([{ 'Razao Social': 'Empresa C', Tipo: 'Novo' }], configMultipla.operadoras[2])
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'A' },
    { 'Razao Social': 'Empresa B', Operadora: 'Vivo', Cliente: 'B' },
    { 'Razao Social': 'Empresa C', Operadora: 'TIM', Cliente: 'C' }
  ];
  const { concluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);
  assert.equal(concluidas.length, 3);
});

test('cruzamento multiplo usa CNPJ como chave principal mesmo com razao social diferente', () => {
  const configMultipla = {
    principal: { ...config.principal, colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'Nome na Claro Ltda', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Nome Basari Diferente', Operadora: 'Claro', Cliente: 'A', CNPJ: '11.111.111/0001-11' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 0);
  assert.equal(concluidas[0].Tipo, 'Novo');
  assert.equal(concluidas[0].Razao_Social_Confirmacao, 'Nome na Claro Ltda');
});

test('cruzamento multiplo mantem vendas repetidas da principal', () => {
  const configMultipla = {
    principal: { ...config.principal, colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'Empresa A', CNPJ: '22.222.222/0001-22', Tipo: 'NOVO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'venda 1', CNPJ: '22.222.222/0001-22' },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'venda 2', CNPJ: '22.222.222/0001-22' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.equal(naoConcluidas.length, 0);
  assert.deepEqual(concluidas.map(item => item.Cliente), ['venda 1', 'venda 2']);
});

test('classificarDocumento distingue CPF (11) de CNPJ (14)', () => {
  assert.equal(classificarDocumento('111.444.777-35').tipo, 'cpf');
  assert.equal(classificarDocumento('11.111.111/0001-11').tipo, 'cnpj');
  assert.equal(classificarDocumento('').tipo, null);
  assert.equal(classificarDocumento('123').tipo, null);
});

test('CPF e CNPJ misturados na principal casam com a confirmacao do tipo certo', () => {
  const configMultipla = {
    principal: { ...config.principal, colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'Documento'] },
    operadoras: [
      { cnpj: 'CNPJ', cpf: 'CPF', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  // Operadora vem com abas separadas ja combinadas: linha de CNPJ preenche CNPJ; linha de CPF preenche CPF.
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'Empresa PJ', CNPJ: '11.111.111/0001-11', CPF: '', Tipo: 'NOVO' },
      { 'Razao Social': 'Cliente PF', CNPJ: '', CPF: '111.444.777-35', Tipo: 'NOVO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  // Principal: documento misturado numa unica coluna mapeada como `cnpj`.
  const principal = [
    { 'Razao Social': 'Empresa PJ', Operadora: 'Claro', Cliente: 'pj', Documento: '11.111.111/0001-11' },
    { 'Razao Social': 'Cliente PF', Operadora: 'Claro', Cliente: 'pf', Documento: '111.444.777-35' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(
    principal,
    indicesOperadoras,
    { ...configMultipla, principal: { ...configMultipla.principal, cnpj: 'Documento' } }
  );

  assert.equal(naoConcluidas.length, 0);
  const porCliente = Object.fromEntries(concluidas.map(item => [item.Cliente, item]));
  assert.equal(porCliente.pj.Tipo_Documento, 'CNPJ');
  assert.equal(porCliente.pf.Tipo_Documento, 'CPF');
  assert.equal(porCliente.pj.Status_Conciliacao, 'PAGO');
  assert.equal(porCliente.pf.Status_Conciliacao, 'PAGO');
});

test('CPF da principal nao casa com CNPJ de mesmos digitos (prefixo de tipo)', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'Documento', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'Documento'] },
    operadoras: [
      { cnpj: 'CNPJ', cpf: 'CPF', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  // Confirmacao tem apenas um CNPJ cujos digitos coincidem com um CPF informado na principal.
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'So PJ', CNPJ: '11144477735000', CPF: '', Tipo: 'NOVO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Sem Match', Operadora: 'Claro', Cliente: 'pf', Documento: '111.444.777-35' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 1);
  assert.equal(naoConcluidas[0].Tipo_Documento, 'CPF');
});

test('cruzamento multiplo respeita mapeamento especifico por aba', () => {
  const configMultipla = {
    principal: {
      razaoSocial: '',
      operadora: '',
      data: '',
      colunasResultado: ['Cliente', 'Doc A', 'Doc B', 'Oper A', 'Oper B'],
      abas: {
        Janeiro: { cnpj: 'Doc A', operadora: 'Oper A' },
        Fevereiro: { cnpj: 'Doc B', operadora: 'Oper B' }
      }
    },
    operadoras: [
      {
        razaoSocial: '',
        tipo: '',
        valorOperadora: 'claro',
        tipoMap: { NOVO: 'Novo' },
        abas: {
          Janeiro: { cnpj: 'Documento Claro', tipo: 'Tipo Claro' },
          Fevereiro: { cnpj: 'Documento Fev', tipo: 'Tipo Fev' }
        }
      }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([
      { __abaOrigem: 'Janeiro', 'Documento Claro': '11.111.111/0001-11', 'Tipo Claro': 'NOVO' },
      { __abaOrigem: 'Fevereiro', 'Documento Fev': '22.222.222/0001-22', 'Tipo Fev': 'NOVO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { __abaOrigem: 'Janeiro', Cliente: 'A', 'Doc A': '11.111.111/0001-11', 'Oper A': 'Claro' },
    { __abaOrigem: 'Fevereiro', Cliente: 'B', 'Doc B': '22.222.222/0001-22', 'Oper B': 'Claro' }
  ];

  const resultado = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(resultado.concluidas.length, 2);
  assert.deepEqual(resultado.concluidas.map(item => item.Cliente), ['A', 'B']);
});

test('cruzamento multiplo usa identificador especifico de cada aba', () => {
  const configMultipla = {
    principal: {
      razaoSocial: '',
      operadora: '',
      data: '',
      colunasResultado: ['Cliente', 'Documento', 'Operadora'],
      abas: {
        Principal: { cnpj: 'Documento', operadora: 'Operadora' }
      }
    },
    operadoras: [
      {
        razaoSocial: '',
        tipo: '',
        valorOperadora: '',
        tipoMap: { NOVO: 'Novo' },
        abas: {
          Claro: { cnpj: 'CNPJ', tipo: 'Tipo', valorOperadora: 'claro' },
          Vivo: { cnpj: 'CNPJ', tipo: 'Tipo', valorOperadora: 'vivo' }
        }
      }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([
      { __abaOrigem: 'Claro', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO' },
      { __abaOrigem: 'Vivo', CNPJ: '22.222.222/0001-22', Tipo: 'NOVO' }
    ], configMultipla.operadoras[0], 'confirmacoes.xlsx')
  ];
  const principal = [
    { __abaOrigem: 'Principal', Cliente: 'Claro', Documento: '11.111.111/0001-11', Operadora: 'Claro' },
    { __abaOrigem: 'Principal', Cliente: 'Vivo', Documento: '22.222.222/0001-22', Operadora: 'Vivo' }
  ];

  const resultado = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(resultado.concluidas.length, 2);
  assert.deepEqual(resultado.concluidas.map(item => item.Cliente), ['Claro', 'Vivo']);
});
