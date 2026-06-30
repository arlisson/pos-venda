const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cruzarMultiplasPlanilhas,
  indexarConfirmacao,
  aplicarTipoMap,
  normalizarChave,
  classificarDocumento,
  nomeAbaValido,
  mesDaData
} = require('../src/services/venda-cruzamento.service');

const config = {
  principal: {
    razaoSocial: 'Razao Social',
    operadora: 'Operadora',
    data: 'Data',
    colunasResultado: ['Razao Social', 'Operadora', 'Cliente']
  }
};

test('normalizarChave remove acento, ignora caixa e colapsa espacos', () => {
  assert.equal(normalizarChave('  Empresa   ÁGIL  Ltda '), 'empresa agil ltda');
  assert.equal(normalizarChave('EMPRESA AGIL LTDA'), 'empresa agil ltda');
});

test('aplicarTipoMap respeita o mapa e ignora caixa/acento', () => {
  assert.equal(aplicarTipoMap({ NOVO: 'Novo' }, 'novo'), 'Novo');
  assert.equal(aplicarTipoMap({ FRESH: 'Novo' }, 'FRESH'), 'Novo');
  assert.equal(aplicarTipoMap({ NOVO: 'Novo' }, 'DESCONHECIDO'), 'DESCONHECIDO');
});

test('mesDaData deriva o mes no formato das operadoras (MMMMYY) em ISO e BR', () => {
  assert.equal(mesDaData('2026-01-15'), 'JANEIRO26');
  assert.equal(mesDaData('15/02/2026'), 'FEVEREIRO26');
  assert.equal(mesDaData('15-03-2026'), 'MARÇO26');
  assert.equal(mesDaData('01/12/26'), 'DEZEMBRO26');
  assert.equal(mesDaData(''), '');
  assert.equal(mesDaData('texto qualquer'), '');
  assert.equal(mesDaData('2026-13-01'), '');
});

test('nomeAbaValido sanitiza caracteres proibidos, trunca, evita duplicatas e trata vazio', () => {
  const usados = new Set();
  assert.equal(nomeAbaValido('Jan/Fev*2026 [parcial]', usados), 'Jan Fev 2026 parcial');
  // mesmo nome de base recebe sufixo para nao colidir
  assert.equal(nomeAbaValido('Janeiro', usados), 'Janeiro');
  assert.equal(nomeAbaValido('Janeiro', usados), 'Janeiro 2');
  // limite de 31 caracteres do Excel
  const longo = nomeAbaValido('M'.repeat(40), usados);
  assert.ok(longo.length <= 31);
  // nome vazio cai para o fallback
  assert.equal(nomeAbaValido('   ', usados), 'Sem mes');
  // proibidos: \ / ? * [ ] :
  assert.doesNotMatch(nomeAbaValido('a:b\\c?d', usados), /[\\/?*[\]:]/);
});

test('match por Razao Social (fallback) ignora caixa, acento e espacos', () => {
  const configMultipla = {
    principal: { ...config.principal },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { INCREMENTO: 'Base' } }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'EMPRESA ÁGIL LTDA', Tipo: 'INCREMENTO' }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [{ 'Razao Social': '  empresa agil   ltda ', Operadora: 'Claro', Cliente: 'Y' }];

  const { concluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 1);
  assert.equal(concluidas[0].Tipo, 'Base');
});

test('Razao Social sem match em nenhuma operadora vai para nao concluidas', () => {
  const configMultipla = {
    principal: { ...config.principal },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', Tipo: 'NOVO' }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [{ 'Razao Social': 'Empresa Sem Match', Operadora: 'Claro', Cliente: 'X' }];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 1);
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
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', Tipo: 'Novo' }], configMultipla.operadoras[0], 'claro.xlsx'),
    indexarConfirmacao([{ 'Razao Social': 'Empresa B', Tipo: 'Base' }], configMultipla.operadoras[1], 'vivo.xlsx'),
    indexarConfirmacao([{ 'Razao Social': 'Empresa C', Tipo: 'Novo' }], configMultipla.operadoras[2], 'tim.xlsx')
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

test('uma confirmacao para duas linhas: uma concluida e a excedente vai para nao concluidas', () => {
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
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'confirmada', CNPJ: '22.222.222/0001-22' },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'excedente', CNPJ: '22.222.222/0001-22' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 1);
});

test('venda compartilhada: operadora consolida em 1 linha de 2 chips e confirma as 2 vendas internas', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', quantidade: 'QTD', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' }, quantidadeColunas: ['Ctns'] }
    ]
  };
  // Fechamento: 1 linha consolidada com 2 chips (Ctns=2).
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO', Ctns: 2 }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  // Principal: venda compartilhada dividida em 2 linhas (1 chip por vendedor).
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'jorge', CNPJ: '11.111.111/0001-11', QTD: 1 },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'joao', CNPJ: '11.111.111/0001-11', QTD: 1 }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.equal(naoConcluidas.length, 0);
  assert.deepEqual(concluidas.map(item => item.Cliente).sort(), ['joao', 'jorge']);
});

test('deteccao automatica: sem mapear, soma as colunas Ctns da operadora e usa QUANTIDADE da principal', () => {
  const configMultipla = {
    // sem `quantidade` na principal e sem `quantidadeColunas` na operadora: tudo detectado pelo nome
    principal: { ...config.principal, cnpj: 'CNPJ', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  // Confirmacao com colunas de contas (detectadas automaticamente): 2 + 1 = 3 chips.
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO', 'Ctns Portabilidade': 2, 'Ctns Novo/Incremento': 1 }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  // Principal com coluna QUANTIDADE (detectada): 2 + 1 = 3 chips.
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'a', CNPJ: '11.111.111/0001-11', QUANTIDADE: 2 },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'b', CNPJ: '11.111.111/0001-11', QUANTIDADE: 1 }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  // 3 chips na principal (2+1) x 3 chips no fechamento (Ctns 2+1) -> 3 chips concluidos.
  assert.equal(concluidas.length, 3);
  assert.equal(naoConcluidas.length, 0);
});

test('estoque por mes: venda de maio nao perde os chips de maio por causa de overflow de marco', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', quantidade: 'QTD', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'BASE/FRESH', valorOperadora: 'vivo', tipoMap: { Fresh: 'Novo', Base: 'Base' } }
    ]
  };
  // Vivo (1 chip por linha): 4 chips em MARÇO26 + 2 chips em MAIO26.
  const indicesOperadoras = [
    indexarConfirmacao([
      { __abaOrigem: 'MARÇO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Fresh' },
      { __abaOrigem: 'MARÇO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Fresh' },
      { __abaOrigem: 'MARÇO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Fresh' },
      { __abaOrigem: 'MARÇO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Fresh' },
      { __abaOrigem: 'MAIO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Base' },
      { __abaOrigem: 'MAIO26', 'Razao Social': 'Rogerio', CNPJ: '34.423.718/0001-02', 'BASE/FRESH': 'Base' }
    ], configMultipla.operadoras[0], 'vivo.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Rogerio', Operadora: 'Vivo', Cliente: 'mar1', CNPJ: '34.423.718/0001-02', QTD: 2, Data: '2026-03-17' },
    { 'Razao Social': 'Rogerio', Operadora: 'Vivo', Cliente: 'mar2', CNPJ: '34.423.718/0001-02', QTD: 3, Data: '2026-03-17' },
    { 'Razao Social': 'Rogerio', Operadora: 'Vivo', Cliente: 'mai1', CNPJ: '34.423.718/0001-02', QTD: 2, Data: '2026-05-08' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  // Chip a chip: 4 chips de marco + 2 de maio confirmados; 1 chip (excedente de marco) nao concluido.
  const conta = (lista, cli) => lista.filter(item => item.Cliente === cli).length;
  assert.equal(concluidas.length, 6);
  assert.equal(naoConcluidas.length, 1);
  // A venda de maio (mai1) fica com os 2 chips confirmados em MAIO26 (nao foi roubada por marco).
  const chipsMai1 = concluidas.filter(item => item.Cliente === 'mai1');
  assert.equal(chipsMai1.length, 2);
  assert.ok(chipsMai1.every(item => item.Aba_Confirmacao === 'MAIO26'));
  // mar1 (2 chips) e mar2 (2 de 3) confirmados em marco; o 3o chip de mar2 fica nao concluido.
  assert.equal(conta(concluidas, 'mar1'), 2);
  assert.equal(conta(concluidas, 'mar2'), 2);
  assert.equal(naoConcluidas[0].Cliente, 'mar2');
});

test('venda com mais chips do que o fechamento: parte conclui, o resto nao (chip a chip)', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', quantidade: 'QTD', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' }, quantidadeColunas: ['Ctns'] }
    ]
  };
  // Fechamento confirma 2 chips; a venda tem 4 chips: 2 chips concluem, 2 ficam nao concluidos.
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO', Ctns: 2 }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'grande', CNPJ: '11.111.111/0001-11', QTD: 4 }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.equal(naoConcluidas.length, 2);
});

test('linha de confirmacao com contas zeradas nao confirma (0 chips)', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', quantidade: 'QTD', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' }, quantidadeColunas: ['Ctns'] }
    ]
  };
  // Unica linha do fechamento com Ctns=0 -> 0 chips -> nao confirma.
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO', Ctns: 0 }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'a', CNPJ: '11.111.111/0001-11', QTD: 1 }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 1);
});

test('chips: vendas alem do total de chips do fechamento vao para nao concluidas', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', quantidade: 'QTD', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' }, quantidadeColunas: ['Ctns'] }
    ]
  };
  // Fechamento confirma 2 chips; principal tem 3 chips (3 linhas de 1).
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO', Ctns: 2 }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'a', CNPJ: '11.111.111/0001-11', QTD: 1 },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'b', CNPJ: '11.111.111/0001-11', QTD: 1 },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'c', CNPJ: '11.111.111/0001-11', QTD: 1 }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.equal(naoConcluidas.length, 1);
});

test('vendas complementares: varias linhas da operadora confirmam varias vendas da principal', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo', INCREMENTO: 'Base' } }
    ]
  };
  // Planilha de fechamento com 2 linhas (vendas distintas) para a mesma empresa.
  const indicesOperadoras = [
    indexarConfirmacao([
      { 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO' },
      { 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'INCREMENTO' }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'venda 1', CNPJ: '11.111.111/0001-11' },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'venda 2', CNPJ: '11.111.111/0001-11' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.equal(naoConcluidas.length, 0);
  assert.deepEqual(concluidas.map(item => item.Cliente).sort(), ['venda 1', 'venda 2']);
  assert.deepEqual(concluidas.map(item => item.Tipo).sort(), ['Base', 'Novo']);
});

test('vendas da principal alem do que a operadora confirmou vao para nao concluidas', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  // Apenas 1 confirmacao, mas 3 linhas na principal: 1 concluida, as 2 excedentes vao para nao concluidas.
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '11.111.111/0001-11', Tipo: 'NOVO' }], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'a', CNPJ: '11.111.111/0001-11' },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'b', CNPJ: '11.111.111/0001-11' },
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'c', CNPJ: '11.111.111/0001-11' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 2);
});

test('sem conciliacao: todos os chips da empresa vao para nao concluidas', () => {
  const configMultipla = {
    principal: { razaoSocial: 'Razao Social', operadora: 'Operadora', data: 'Data', colunasResultado: ['Razao Social', 'Operadora', 'Cliente'] },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: {} }
    ]
  };
  const indicesOperadoras = [indexarConfirmacao([], configMultipla.operadoras[0], 'claro.xlsx')];
  const principal = [
    { 'Razao Social': 'Empresa E', Operadora: 'Claro', Cliente: 'venda 1', Data: '2026-01-01' },
    { 'Razao Social': 'Empresa E', Operadora: 'Claro', Cliente: 'venda 2', Data: '2026-03-01' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  // Operadora nao confirmou nada: os 2 chips (1 por venda) ficam nao concluidos.
  assert.equal(concluidas.length, 0);
  assert.equal(naoConcluidas.length, 2);
});

test('classificarDocumento completa zeros a esquerda perdidos quando salvo como numero', () => {
  // CNPJ de 13 digitos (zero a esquerda perdido) gera a mesma chave do formatado de 14
  assert.equal(classificarDocumento('1327884000156').tipo, 'cnpj');
  assert.equal(classificarDocumento('1327884000156').chave, classificarDocumento('01.327.884/0001-56').chave);
  // 12 digitos tambem e CNPJ
  assert.equal(classificarDocumento('123456789012').tipo, 'cnpj');
  // CPF de 10 digitos (zero a esquerda perdido) gera a mesma chave do formatado de 11
  assert.equal(classificarDocumento('1234567890').tipo, 'cpf');
  assert.equal(classificarDocumento('1234567890').chave, classificarDocumento('012.345.678-90').chave);
  // muito curto continua invalido
  assert.equal(classificarDocumento('123').tipo, null);
});

test('CNPJ salvo como numero (sem zero a esquerda) casa pelo documento mesmo com razao diferente', () => {
  const configMultipla = {
    principal: { ...config.principal, cnpj: 'CNPJ', colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { cnpj: 'CNPJ', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'vivo', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  const indicesOperadoras = [
    // CNPJ vindo como numero (13 digitos), razao social diferente da principal
    indexarConfirmacao([{ 'Razao Social': 'Nome Diferente Na Vivo', CNPJ: 1327884000156, Tipo: 'NOVO' }], configMultipla.operadoras[0], 'vivo.xlsx')
  ];
  const principal = [
    { 'Razao Social': 'Empresa Basari', Operadora: 'Vivo', Cliente: 'A', CNPJ: '01.327.884/0001-56' }
  ];

  const { concluidas, naoConcluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 1);
  assert.equal(naoConcluidas.length, 0);
  assert.equal(concluidas[0].Tipo, 'Novo');
});

test('vendas distintas (operadoras diferentes) nao sao deduplicadas', () => {
  const configMultipla = {
    principal: { ...config.principal, colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'CNPJ'] },
    operadoras: [
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } },
      { razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'vivo', tipoMap: { NOVO: 'Novo' } }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '22.222.222/0001-22', Tipo: 'NOVO' }], configMultipla.operadoras[0], 'claro.xlsx'),
    indexarConfirmacao([{ 'Razao Social': 'Empresa A', CNPJ: '22.222.222/0001-22', Tipo: 'NOVO' }], configMultipla.operadoras[1], 'vivo.xlsx')
  ];
  // Mesma empresa e documento, mas operadoras diferentes: sao duas vendas, nao uma refeita.
  const principal = [
    { 'Razao Social': 'Empresa A', Operadora: 'Claro', Cliente: 'na claro', CNPJ: '22.222.222/0001-22' },
    { 'Razao Social': 'Empresa A', Operadora: 'Vivo', Cliente: 'na vivo', CNPJ: '22.222.222/0001-22' }
  ];

  const { concluidas } = cruzarMultiplasPlanilhas(principal, indicesOperadoras, configMultipla);

  assert.equal(concluidas.length, 2);
  assert.deepEqual(concluidas.map(item => item.Cliente).sort(), ['na claro', 'na vivo']);
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

test('cruzamento multiplo aplica mapeamento geral pela posicao da coluna', () => {
  const configMultipla = {
    principal: {
      cnpj: 'Documento',
      cnpjIndex: 2,
      operadora: 'Operadora',
      operadoraIndex: 3,
      colunasResultado: ['Cliente', 'Documento', 'Operadora'],
      abas: {}
    },
    operadoras: [
      {
        cnpj: 'CNPJ Janeiro',
        cnpjIndex: 1,
        tipo: 'Tipo Janeiro',
        tipoIndex: 2,
        valorOperadora: 'claro',
        tipoMap: { NOVO: 'Novo' },
        abas: {}
      }
    ]
  };
  const indicesOperadoras = [
    indexarConfirmacao([
      {
        __abaOrigem: 'Janeiro',
        'CNPJ Janeiro': '11.111.111/0001-11',
        'Tipo Janeiro': 'NOVO',
        __colunasPorIndice: { 1: '11.111.111/0001-11', 2: 'NOVO' }
      },
      {
        __abaOrigem: 'Fevereiro',
        'Documento Fev': '22.222.222/0001-22',
        'Classificacao Fev': 'NOVO',
        __colunasPorIndice: { 1: '22.222.222/0001-22', 2: 'NOVO' }
      }
    ], configMultipla.operadoras[0], 'claro.xlsx')
  ];
  const principal = [
    { Cliente: 'A', Documento: '11.111.111/0001-11', Operadora: 'Claro', __colunasPorIndice: { 2: '11.111.111/0001-11', 3: 'Claro' } },
    { Cliente: 'B', Documento: '22.222.222/0001-22', Operadora: 'Claro', __colunasPorIndice: { 2: '22.222.222/0001-22', 3: 'Claro' } }
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
