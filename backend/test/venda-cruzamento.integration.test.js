const test = require('node:test');
const assert = require('node:assert/strict');
const FormData = require('form-data');
const ExcelJS = require('exceljs');

const {
  previewCruzamento,
  processarCruzamento
} = require('../src/services/venda-cruzamento.service');

/**
 * Gera um buffer .xlsx a partir de um mapa { nomeAba: { header: [], rows: [[]] } }.
 */
async function xlsxBuffer(abas) {
  const workbook = new ExcelJS.Workbook();
  for (const [nome, { header, rows }] of Object.entries(abas)) {
    const worksheet = workbook.addWorksheet(nome);
    worksheet.addRow(header);
    rows.forEach(linha => worksheet.addRow(linha));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Monta um "req" multipart simulado a partir de arquivos e do campo config.
 * O FormData ja e um stream legivel; expomos headers para o Busboy do service.
 */
function montarReq({ arquivos = [], config } = {}) {
  const form = new FormData();
  arquivos.forEach(arquivo => {
    form.append('planilhas', arquivo.buffer, {
      filename: arquivo.filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  });
  if (config !== undefined) {
    form.append('config', typeof config === 'string' ? config : JSON.stringify(config));
  }
  form.headers = form.getHeaders();
  return form;
}

const PRINCIPAL = {
  filename: 'principal.xlsx',
  abas: {
    Plan1: {
      header: ['Razao Social', 'Operadora', 'Cliente', 'Documento', 'Data'],
      rows: [['Empresa A', 'Claro', 'venda 1', '11.111.111/0001-11', '2026-01-15']]
    }
  }
};

const CLARO = {
  filename: 'claro.xlsx',
  // Confirmacao organizada por mes (uma aba por mes), como nas planilhas reais da Claro/Vivo.
  abas: {
    JANEIRO26: {
      header: ['Razao Social', 'CNPJ', 'Tipo'],
      rows: [['Empresa A', '11.111.111/0001-11', 'NOVO']]
    }
  }
};

const CONFIG_VALIDA = {
  principal: {
    cnpj: 'Documento',
    operadora: 'Operadora',
    razaoSocial: 'Razao Social',
    data: 'Data',
    colunasResultado: ['Razao Social', 'Operadora', 'Cliente', 'Documento']
  },
  operadoras: [
    { cnpj: 'CNPJ', cpf: '', razaoSocial: 'Razao Social', tipo: 'Tipo', valorOperadora: 'claro', tipoMap: { NOVO: 'Novo' } }
  ],
  selecoesAbas: [
    { arquivoIndex: 0, aba: 'Plan1', usar: true },
    { arquivoIndex: 1, aba: 'JANEIRO26', usar: true }
  ]
};

async function arquivosPadrao() {
  return [
    { filename: PRINCIPAL.filename, buffer: await xlsxBuffer(PRINCIPAL.abas) },
    { filename: CLARO.filename, buffer: await xlsxBuffer(CLARO.abas) }
  ];
}

test('previewCruzamento le as planilhas e sugere o mapeamento', async () => {
  const req = montarReq({ arquivos: await arquivosPadrao() });
  const preview = await previewCruzamento(req);

  assert.equal(preview.principal.total_linhas, 1);
  assert.equal(preview.operadoras.length, 1);
  assert.equal(preview.sugestoes.principal.operadora, 'Operadora');
  assert.equal(preview.sugestoes.operadoras[0].cnpj, 'CNPJ');
});

test('concluida vai para a aba do mes em que a operadora confirmou', async () => {
  const req = montarReq({ arquivos: await arquivosPadrao(), config: CONFIG_VALIDA });
  const buffer = await processarCruzamento(req);

  assert.ok(Buffer.isBuffer(buffer) && buffer.length > 0);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const nomes = workbook.worksheets.map(ws => ws.name);
  // A Claro confirmou na aba JANEIRO26: a concluida segue essa organizacao de mes.
  assert.deepEqual(nomes, ['Resumo', 'JANEIRO26', 'Vendas Nao Concluidas']);

  const concluidas = workbook.getWorksheet('JANEIRO26');
  // linha 1 = cabecalho; linha 2 = a venda conciliada
  assert.equal(concluidas.rowCount, 2);
  const header = concluidas.getRow(1).values.slice(1);
  const linha = concluidas.getRow(2).values.slice(1);
  const registro = Object.fromEntries(header.map((nome, i) => [nome, linha[i]]));
  assert.equal(registro.Tipo, 'Novo');
  assert.equal(registro.Status_Conciliacao, 'PAGO');
});

test('agrupa concluidas pelo mes da confirmacao em ordem cronologica e nao concluidas numa aba unica', async () => {
  const principal = {
    filename: 'principal.xlsx',
    abas: {
      Plan1: {
        header: ['Razao Social', 'Operadora', 'Cliente', 'Documento', 'Data'],
        // fora de ordem de propósito, para provar a ordenacao cronologica da saida
        rows: [
          ['Empresa B', 'Claro', 'fev ok', '22.222.222/0001-22', '10/02/2026'],
          ['Empresa A', 'Claro', 'jan ok', '11.111.111/0001-11', '15/01/2026'],
          ['Empresa C', 'Claro', 'fev sem match', '33.333.333/0001-33', '20/02/2026']
        ]
      }
    }
  };
  const claro = {
    filename: 'claro.xlsx',
    abas: {
      JANEIRO26: {
        header: ['Razao Social', 'CNPJ', 'Tipo'],
        rows: [['Empresa A', '11.111.111/0001-11', 'NOVO']]
      },
      FEVEREIRO26: {
        header: ['Razao Social', 'CNPJ', 'Tipo'],
        rows: [['Empresa B', '22.222.222/0001-22', 'NOVO']]
      }
    }
  };
  const config = {
    ...CONFIG_VALIDA,
    selecoesAbas: [
      { arquivoIndex: 0, aba: 'Plan1', usar: true },
      { arquivoIndex: 1, aba: 'JANEIRO26', usar: true },
      { arquivoIndex: 1, aba: 'FEVEREIRO26', usar: true }
    ]
  };
  const arquivos = [
    { filename: principal.filename, buffer: await xlsxBuffer(principal.abas) },
    { filename: claro.filename, buffer: await xlsxBuffer(claro.abas) }
  ];

  const buffer = await processarCruzamento(montarReq({ arquivos, config }));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Resumo + abas-mes das confirmacoes em ordem cronologica + a aba unica de nao concluidas.
  assert.deepEqual(workbook.worksheets.map(ws => ws.name), ['Resumo', 'JANEIRO26', 'FEVEREIRO26', 'Vendas Nao Concluidas']);

  const clienteDaAba = nome => {
    const ws = workbook.getWorksheet(nome);
    const header = ws.getRow(1).values.slice(1);
    const col = header.indexOf('Cliente');
    return ws.getRow(2).values.slice(1)[col];
  };
  assert.equal(clienteDaAba('JANEIRO26'), 'jan ok');
  assert.equal(clienteDaAba('FEVEREIRO26'), 'fev ok');

  // A nao concluida fica na aba unica, com o Mes derivado da Data da venda (20/02/2026).
  const naoConcluidas = workbook.getWorksheet('Vendas Nao Concluidas');
  const header = naoConcluidas.getRow(1).values.slice(1);
  assert.equal(header[0], 'Mês');
  const registro = Object.fromEntries(header.map((nome, i) => [nome, naoConcluidas.getRow(2).values.slice(1)[i]]));
  assert.equal(registro.Cliente, 'fev sem match');
  assert.equal(registro['Mês'], 'FEVEREIRO26');
});

test('estilo: linha divergente sai amarela e o Resumo traz as contagens por status', async () => {
  const principal = {
    filename: 'principal.xlsx',
    abas: {
      Plan1: {
        header: ['Razao Social', 'Operadora', 'Cliente', 'Documento', 'Data', 'Valor'],
        rows: [
          ['Empresa A', 'Claro', 'ok', '11.111.111/0001-11', '15/01/2026', '69,99'],
          ['Empresa B', 'Claro', 'divergente', '22.222.222/0001-22', '15/01/2026', '49,99']
        ]
      }
    }
  };
  const claro = {
    filename: 'claro.xlsx',
    abas: {
      JANEIRO26: {
        header: ['Razao Social', 'CNPJ', 'Tipo', 'Receita'],
        rows: [
          ['Empresa A', '11.111.111/0001-11', 'NOVO', '69,99'],
          ['Empresa B', '22.222.222/0001-22', 'NOVO', '54,99']
        ]
      }
    }
  };
  const config = {
    ...CONFIG_VALIDA,
    principal: { ...CONFIG_VALIDA.principal, valor: 'Valor' },
    operadoras: [{ ...CONFIG_VALIDA.operadoras[0], valorColunas: ['Receita'] }]
  };
  const arquivos = [
    { filename: principal.filename, buffer: await xlsxBuffer(principal.abas) },
    { filename: claro.filename, buffer: await xlsxBuffer(claro.abas) }
  ];

  const buffer = await processarCruzamento(montarReq({ arquivos, config }));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const aba = workbook.getWorksheet('JANEIRO26');
  const header = aba.getRow(1).values.slice(1);
  const iStatus = header.indexOf('Status_Conciliacao') + 1;
  // Cabecalho colorido (azul dos meses).
  assert.equal(aba.getRow(1).getCell(1).fill?.fgColor?.argb, 'FF305496');

  const statusPorLinha = [2, 3].map(r => aba.getRow(r).getCell(iStatus).value);
  const linhaDivergente = 2 + statusPorLinha.indexOf('PAGO_VALOR_DIVERGENTE');
  const linhaPaga = 2 + statusPorLinha.indexOf('PAGO');
  assert.ok(linhaDivergente >= 2 && linhaPaga >= 2);
  // A linha divergente sai inteira em amarelo; a paga, nao.
  assert.equal(aba.getRow(linhaDivergente).getCell(1).fill?.fgColor?.argb, 'FFFFF2CC');
  assert.equal(aba.getRow(linhaDivergente).getCell(header.length).fill?.fgColor?.argb, 'FFFFF2CC');
  assert.notEqual(aba.getRow(linhaPaga).getCell(1).fill?.fgColor?.argb, 'FFFFF2CC');

  // Resumo primeiro, com as contagens por status.
  assert.equal(workbook.worksheets[0].name, 'Resumo');
  const resumo = workbook.getWorksheet('Resumo');
  const contagens = {};
  resumo.eachRow(row => {
    const rotulo = row.getCell(1).value;
    if (typeof rotulo === 'string' && /^(PAGO|PAGO_VALOR_DIVERGENTE|VALIDAR_MANUALMENTE|NAO_ENCONTRADO|CANCELADA)$/.test(rotulo)) {
      contagens[rotulo] = row.getCell(3).value;
    }
  });
  assert.equal(contagens.PAGO, 1);
  assert.equal(contagens.PAGO_VALOR_DIVERGENTE, 1);
  assert.equal(contagens.NAO_ENCONTRADO, 0);
});

test('processarCruzamento erra com mensagem clara quando um arquivo fica sem abas', async () => {
  const config = {
    ...CONFIG_VALIDA,
    selecoesAbas: [
      { arquivoIndex: 0, aba: 'Plan1', usar: true },
      { arquivoIndex: 1, aba: 'JANEIRO26', usar: false }
    ]
  };
  const req = montarReq({ arquivos: await arquivosPadrao(), config });

  await assert.rejects(
    () => processarCruzamento(req),
    error => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /ao menos uma aba do arquivo "claro\.xlsx"/);
      return true;
    }
  );
});

test('processarCruzamento rejeita arquivo acima do limite de tamanho', async () => {
  const anterior = process.env.CRUZAMENTO_LIMITE_BYTES;
  process.env.CRUZAMENTO_LIMITE_BYTES = '1024'; // 1 KB: qualquer .xlsx real estoura
  try {
    const req = montarReq({ arquivos: await arquivosPadrao(), config: CONFIG_VALIDA });
    await assert.rejects(
      () => processarCruzamento(req),
      error => {
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /excede o limite/);
        return true;
      }
    );
  } finally {
    if (anterior === undefined) delete process.env.CRUZAMENTO_LIMITE_BYTES;
    else process.env.CRUZAMENTO_LIMITE_BYTES = anterior;
  }
});

test('lerMultipart continua exigindo ao menos duas planilhas', async () => {
  const req = montarReq({ arquivos: [{ filename: PRINCIPAL.filename, buffer: await xlsxBuffer(PRINCIPAL.abas) }] });
  await assert.rejects(
    () => previewCruzamento(req),
    error => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /principal e ao menos uma planilha/);
      return true;
    }
  );
});
