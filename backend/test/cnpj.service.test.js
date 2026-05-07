const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/connection');
const {
  calcularConfianca,
  combinarResultados,
  montarPayloadCache,
  normalizarBrasilApi,
  normalizarCnpja,
  normalizarCnpjws,
  validarCnpj,
  validarDigitosCnpj
} = require('../src/services/cnpj.service');

test.after(async () => {
  await db.destroy();
});

test('valida CNPJ por tamanho, repeticao e digitos verificadores', () => {
  assert.equal(validarDigitosCnpj('11222333000181'), true);
  assert.equal(validarCnpj('11.222.333/0001-81'), '11222333000181');
  assert.equal(validarDigitosCnpj('11222333000182'), false);
  assert.throws(() => validarCnpj('11.222.333/0001-82'), /CNPJ/);
  assert.throws(() => validarCnpj('11.222'), /14/);
  assert.throws(() => validarCnpj('00.000.000/0000-00'), /CNPJ/);
});

test('normaliza payloads das tres fontes com datas quando existirem', () => {
  assert.deepEqual(normalizarBrasilApi({
    razao_social: 'Empresa Brasil',
    nome_fantasia: 'Brasil',
    descricao_situacao_cadastral: 'ATIVA',
    email: 'contato@empresa.test',
    ddd_telefone_1: '11999998888',
    cep: '01001000',
    logradouro: 'Praca da Se',
    numero: '1',
    bairro: 'Se',
    municipio: 'Sao Paulo',
    uf: 'sp'
  }), {
    razaoSocial: 'Empresa Brasil',
    nomeFantasia: 'Brasil',
    situacaoCadastral: 'ATIVA',
    email: 'contato@empresa.test',
    telefone: '11999998888',
    cep: '01001000',
    endereco: 'Praca da Se',
    numero: '1',
    complemento: '',
    bairro: 'Se',
    municipio: 'Sao Paulo',
    uf: 'SP',
    fonte: 'BrasilAPI',
    atualizadoEm: null
  });

  assert.equal(normalizarCnpja({
    updated: '2026-03-01T00:00:00.000Z',
    company: { name: 'Empresa CNPJa' },
    alias: 'CNPJa',
    status: { text: 'Ativa' },
    phones: [{ area: '11', number: '33334444' }],
    emails: [{ address: 'cnpja@empresa.test' }],
    address: { zip: '01002000', street: 'Rua Direita', number: '2', district: 'Centro', city: 'Sao Paulo', state: 'SP' }
  }).atualizadoEm, '2026-03-01T00:00:00.000Z');

  assert.equal(normalizarCnpjws({
    atualizado_em: '2026-03-02T00:00:00.000Z',
    razao_social: 'Empresa CNPJws',
    estabelecimento: {
      nome_fantasia: 'CNPJws',
      situacao_cadastral: 'Ativa',
      ddd1: '11',
      telefone1: '22223333',
      cep: '01003000',
      tipo_logradouro: 'Rua',
      logradouro: 'Boa Vista',
      numero: '3',
      bairro: 'Centro',
      cidade: { nome: 'Sao Paulo' },
      estado: { sigla: 'SP' }
    }
  }).atualizadoEm, '2026-03-02T00:00:00.000Z');
});

test('calcula confianca por data e divergencia', () => {
  const referencia = new Date('2026-05-07T00:00:00.000Z');
  assert.equal(calcularConfianca('2026-04-01T00:00:00.000Z', false, referencia), 'alta');
  assert.equal(calcularConfianca(null, false, referencia), 'media');
  assert.equal(calcularConfianca('2026-01-01T00:00:00.000Z', false, referencia), 'media');
  assert.equal(calcularConfianca('2025-01-01T00:00:00.000Z', false, referencia), 'baixa');
  assert.equal(calcularConfianca('2026-04-01T00:00:00.000Z', true, referencia), 'baixa');
});

test('combina resultados com fontes por campo, alternativas e alertas', () => {
  const payload = combinarResultados([
    {
      fonte: 'BrasilAPI',
      ok: true,
      normalizado: { razaoSocial: 'Empresa A', endereco: 'Rua Um', fonte: 'BrasilAPI', atualizadoEm: null }
    },
    {
      fonte: 'CNPJws',
      ok: true,
      normalizado: { razaoSocial: 'Empresa B', endereco: 'Rua Dois', fonte: 'CNPJws', atualizadoEm: '2026-03-01T00:00:00.000Z' }
    },
    {
      fonte: 'CNPJa',
      ok: false,
      code: 'timeout',
      status: null,
      message: 'timeout'
    }
  ]);

  assert.equal(payload.razaoSocial, 'Empresa A');
  assert.deepEqual(payload.fontesComSucesso, ['BrasilAPI', 'CNPJws']);
  assert.equal(payload.fontesComErro[0].fonte, 'CNPJa');
  assert.equal(payload.fontesPorCampo.razaoSocial.divergente, true);
  assert.equal(payload.fontesPorCampo.razaoSocial.confianca, 'baixa');
  assert.equal(payload.alternativasPorCampo.razaoSocial.length, 2);
  assert.equal(payload.alertas.some(alerta => alerta.tipo === 'divergencia' && alerta.campo === 'razaoSocial'), true);
});

test('enriquece payload antigo vindo do cache sem metadados novos', () => {
  const payload = montarPayloadCache({
    payload_normalizado: JSON.stringify({
      razaoSocial: 'Empresa Cache',
      fonte: 'BrasilAPI',
      fontesPorCampo: { razaoSocial: 'BrasilAPI' }
    }),
    fontes: JSON.stringify(['BrasilAPI']),
    created_at: '2026-05-01 10:00:00',
    updated_at: '2026-05-02 10:00:00',
    expira_em: '2026-06-01 10:00:00'
  });

  assert.equal(payload.razaoSocial, 'Empresa Cache');
  assert.equal(payload.cache, true);
  assert.deepEqual(payload.fontesConsultadas, ['BrasilAPI', 'CNPJa', 'CNPJws']);
  assert.deepEqual(payload.fontesComSucesso, ['BrasilAPI']);
  assert.deepEqual(payload.fontesComErro, []);
  assert.deepEqual(payload.fontesPorCampo.razaoSocial, {
    fonte: 'BrasilAPI',
    atualizadoEm: null,
    confianca: 'media',
    divergente: false
  });
  assert.deepEqual(payload.alternativasPorCampo, {});
  assert.deepEqual(payload.alertas, []);
});
