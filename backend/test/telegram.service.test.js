const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../src/services/telegram.service');

test('monta notificacao de futuro cliente com dados da sondagem e primeira ligacao', () => {
  const texto = _internals.montarMensagemFuturoCliente({
    futuro_cliente_marcado_em: '2026-07-15T12:00:00.000Z',
    futuro_cliente_retorno: '2026-07-20T15:30:00.000Z',
    sondagem: {
      razao_social: 'Empresa Teste LTDA', cnpj: '12.345.678/0001-90', contato_nome: 'Maria', contato_tipo: 'adm',
      melhor_numero_contato: '11999998888', whatsapp_ddd: '11', whatsapp_numero: '999998888', telefone_fixo: '1133334444', terminal: '11988887777', operadoraAtual: { nome: 'Claro' }, operadoraInteresse: { nome: 'Vivo' },
      chips_itens: [{ quantidade: 2, preco_por_chip: 49.9 }], valor_mensal_estimado: 99.8,
      usuario: { nome: 'Consultor Teste' }, observacoes: 'Retornar na proxima semana'
    }
  });

  assert.match(texto, /Empresa: Empresa Teste LTDA/);
  assert.match(texto, /WhatsApp: \(11\) 99999-8888/);
  assert.match(texto, /Fixo: \(11\) 3333-4444/);
  assert.match(texto, /Terminal: \(11\) 98888-7777/);
  assert.match(texto, /Melhor número para contato: \(11\) 99999-8888/);
  assert.match(texto, /Operadora atual: Claro/);
  assert.match(texto, /Operadora de interesse: Vivo/);
  assert.match(texto, /Valor mensal estimado: R\$\s?99,80/);
  assert.match(texto, /Data do contato: 15\/07\/2026/);
  assert.match(texto, /Primeira liga\u00E7\u00E3o: Consultor Teste/);
});
