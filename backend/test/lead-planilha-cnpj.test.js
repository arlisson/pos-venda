const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const db = require('../src/database/connection');
const { _internals } = require('../src/services/lead-planilha.service');
const { restaurarZerosCnpj } = require('../src/services/cnpj.service');

test.after(async () => {
  await db.destroy();
});

/**
 * Monta um workbook em memoria com uma coluna CNPJ, preservando o tipo de cada
 * celula (numero x texto) para reproduzir o que o Excel realmente envia.
 */
async function montarWorkbook(valoresCnpj, { numFmt = null, cabecalho = 'CNPJ' } = {}) {
  const workbook = new ExcelJS.Workbook();
  const aba = workbook.addWorksheet('Mailing');
  aba.addRow([cabecalho, 'Razao Social']);
  valoresCnpj.forEach((valor, index) => {
    const linha = aba.addRow([valor, `Empresa ${index + 1}`]);
    if (numFmt) linha.getCell(1).numFmt = numFmt;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const lido = new ExcelJS.Workbook();
  await lido.xlsx.load(buffer);
  return lido;
}

function cnpjsDaColecao(colecoes, cabecalho = 'CNPJ') {
  return colecoes[0].linhas.map(linha => linha[cabecalho]);
}

test('recupera zeros a esquerda de CNPJ numerico vindo do Excel', async () => {
  const workbook = await montarWorkbook([1234567000189, 402965000100, 70006000135]);
  const colecoes = _internals.montarColecoesExcel('mailing.xlsx', workbook, null, { cnpj: 'CNPJ' });

  assert.deepEqual(cnpjsDaColecao(colecoes), [
    '01234567000189',
    '00402965000100',
    '00070006000135'
  ]);
});

test('recupera zeros mesmo sem mapeamento, pelo nome do cabecalho', async () => {
  const workbook = await montarWorkbook([1234567000189], { cabecalho: 'CPF/CNPJ' });
  const colecoes = _internals.montarColecoesExcel('mailing.xlsx', workbook, null, {});

  assert.deepEqual(cnpjsDaColecao(colecoes, 'CPF/CNPJ'), ['01234567000189']);
});

test('mantem intacto o CNPJ que ja veio completo ou mascarado', async () => {
  const workbook = await montarWorkbook(['01.234.567/0001-89', '01234567000189']);
  const colecoes = _internals.montarColecoesExcel('mailing.xlsx', workbook, null, { cnpj: 'CNPJ' });

  assert.deepEqual(cnpjsDaColecao(colecoes), ['01.234.567/0001-89', '01234567000189']);
});

test('usa o texto formatado da celula quando a planilha tem mascara de CNPJ', async () => {
  const workbook = await montarWorkbook([1234567000189], { numFmt: '00000000000000' });
  const colecoes = _internals.montarColecoesExcel('mailing.xlsx', workbook, null, { cnpj: 'CNPJ' });

  assert.deepEqual(cnpjsDaColecao(colecoes), ['01234567000189']);
});

test('nao mexe em CPF valido de 11 digitos na coluna de documento', async () => {
  const workbook = await montarWorkbook(['12345678909'], { cabecalho: 'Documento' });
  const colecoes = _internals.montarColecoesExcel('mailing.xlsx', workbook, null, {});

  assert.deepEqual(cnpjsDaColecao(colecoes, 'Documento'), ['12345678909']);
});

test('recupera zeros a esquerda no CSV de mailing', () => {
  const csv = 'CNPJ;Razao Social\n1234567000189;Empresa A\n01.234.567/0001-89;Empresa B\n';
  const colecoes = _internals.montarColecaoCsv('mailing.csv', Buffer.from(csv, 'utf8'));

  assert.deepEqual(cnpjsDaColecao(colecoes), ['01234567000189', '01.234.567/0001-89']);
});

test('extrai CNPJ de linha antiga gravada sem os zeros a esquerda', () => {
  const cnpjs = _internals.extrairCnpjsLinha({
    dados_json: JSON.stringify({ CNPJ: '1234567000189', Razao: 'Empresa A' })
  });

  assert.deepEqual([...cnpjs], ['01234567000189']);
});

test('restaurarZerosCnpj ignora valores que nao sao documento', () => {
  assert.equal(restaurarZerosCnpj(''), '');
  assert.equal(restaurarZerosCnpj('123'), '');
  assert.equal(restaurarZerosCnpj('11111111111111'), '');
  assert.equal(restaurarZerosCnpj('12345678909'), '');
});
