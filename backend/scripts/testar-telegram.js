const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const telegramService = require('../src/services/telegram.service');

const alvo = String(process.argv[2] || 'all').trim().toLowerCase();
const somenteVisualizar = process.argv.includes('--preview');
const alvosValidos = ['all', 'vendas', 'futuros', 'resumo'];

if (!alvosValidos.includes(alvo)) {
  console.error('Uso: npm run telegram:smoke -- [all|vendas|futuros|resumo] [--preview]');
  process.exit(1);
}

const vendaFicticia = {
  mensagem_teste: true,
  id: 999999,
  nome: 'Empresa Fictícia de Teste',
  razao_social: 'EMPRESA FICTÍCIA DE TESTE LTDA',
  cnpj: '00.000.000/0000-00',
  telefone: '11999999999',
  email: 'teste@exemplo.local',
  origem_lead_linha_id: 999999,
  origemSondador: { nome: 'Consultor da primeira ligação (teste)' },
  vendedoras: [{ nome: 'Vendedora de teste' }],
  criador: { nome: 'Usuário de teste' },
  operadora: { nome: 'Operadora de teste' },
  tipoProduto: { nome: 'Móvel' },
  tipoVenda: { nome: 'Portabilidade' },
  servico: { nome: 'Plano empresarial de teste' },
  quantidade_linhas: 2,
  valores_unitarios_chips: [
    { quantidade: 2, gb: '30', tipo_linha: 'portabilidade', valor_unitario: 59.9 }
  ],
  valor_total: 119.8,
  data_venda: new Date().toISOString(),
  protocolo: 'TESTE-SEM-REGISTRO',
  observacoes: 'Mensagem fictícia. Nenhuma venda foi cadastrada.'
};

const futuroClienteFicticio = {
  id: 999999,
  futuro_cliente_marcado_em: new Date().toISOString(),
  sondagem: {
    razao_social: 'Futuro Cliente Fictício',
    cnpj: '00.000.000/0000-00',
    contato_nome: 'Contato de teste',
    contato_tipo: 'adm',
    melhor_numero_contato: '11999999999',
    whatsapp_ddd: '11',
    whatsapp_numero: '999999999',
    operadoraAtual: { nome: 'Operadora atual de teste' },
    operadoraInteresse: { nome: 'Operadora de interesse de teste' },
    chips_itens: [{ quantidade: 2, preco_por_chip: 49.9 }],
    valor_mensal_estimado: 99.8,
    usuario: { nome: 'Consultor de teste' },
    observacoes: 'Mensagem fictícia. Nenhum futuro cliente foi registrado.'
  }
};

const resumoFicticio = [
  '🧪 TESTE — RESUMO DIÁRIO DE VENDAS',
  '',
  'Data: teste manual',
  'Vendas cadastradas: 3',
  'Linhas vendidas: 5',
  'Valor total: R$ 299,50',
  '',
  'Mensagem fictícia. Nenhum dado foi gravado e não é necessário aguardar o fim do dia.'
].join('\n');

function exigirConfiguracao(nomeChatId) {
  if (!String(process.env.TELEGRAM_BOT_TOKEN || '').trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN não está configurado.');
  }
  if (!telegramService._internals.obterChatId(nomeChatId)) {
    throw new Error(`${nomeChatId} não está configurado.`);
  }
}

async function testarVendas() {
  const texto = telegramService._internals.montarMensagemVenda(vendaFicticia);
  if (somenteVisualizar) return texto;
  exigirConfiguracao('TELEGRAM_VENDAS_CHAT_ID');
  const resultado = await telegramService.enviarVenda(vendaFicticia);
  return `enviada (message_id: ${resultado.message_id || 'não retornado'})`;
}

async function testarFuturos() {
  const texto = [
    '🧪 TESTE — FUTURO CLIENTE (DADOS FICTÍCIOS)',
    '',
    telegramService._internals.montarMensagemFuturoCliente(futuroClienteFicticio)
  ].join('\n');
  if (somenteVisualizar) return texto;
  exigirConfiguracao('TELEGRAM_FUTUROS_CLIENTES_CHAT_ID');
  const resultado = await telegramService.chamarApi('sendMessage', {
    chat_id: telegramService._internals.obterChatId('TELEGRAM_FUTUROS_CLIENTES_CHAT_ID'),
    text: texto,
    disable_web_page_preview: true
  });
  return `enviada (message_id: ${resultado?.message_id || 'não retornado'})`;
}

async function testarResumo() {
  if (somenteVisualizar) return resumoFicticio;
  exigirConfiguracao('TELEGRAM_RESUMO_VENDAS_CHAT_ID');
  const resultado = await telegramService.enviarResumoVendas(resumoFicticio);
  return `enviada (message_id: ${resultado.message_id || 'não retornado'})`;
}

const testes = { vendas: testarVendas, futuros: testarFuturos, resumo: testarResumo };

async function executar() {
  const selecionados = alvo === 'all' ? Object.keys(testes) : [alvo];
  for (const nome of selecionados) {
    const resultado = await testes[nome]();
    if (somenteVisualizar) {
      console.log(`\n--- ${nome.toUpperCase()} ---\n${resultado}`);
    } else {
      console.log(`${nome}: ${resultado}`);
    }
  }
}

executar().catch(error => {
  console.error(`Falha no teste do Telegram: ${error.message}`);
  process.exitCode = 1;
});
