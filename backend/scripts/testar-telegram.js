const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const telegramService = require('../src/services/telegram.service');

const alvo = String(process.argv[2] || 'all').trim().toLowerCase();
const somenteVisualizar = process.argv.includes('--preview');
const vendaIdArg = process.argv.find(arg => arg.startsWith('--venda-id='));
const vendaId = vendaIdArg ? Number(vendaIdArg.split('=')[1]) : null;
const alvosValidos = ['all', 'vendas', 'futuros', 'resumo'];
let conexaoBanco = null;

if (!alvosValidos.includes(alvo)) {
  console.error('Uso: npm run telegram:smoke -- [all|vendas|futuros|resumo] [--preview] [--venda-id=123]');
  process.exit(1);
}

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

async function carregarVendaLocal() {
  conexaoBanco = require('../src/database/connection');
  const Venda = require('../src/models/Venda');
  let query = Venda.query()
    .whereNull('excluido_em')
    .withGraphFetched('[cliente, vendedora, vendedoras, origemSondador, operadora, operadoraAtual, tipoProduto, tipoVenda, servico, criador]');
  query = vendaId
    ? query.findById(vendaId)
    : query.orderBy('id', 'desc').first();
  const venda = await query;
  if (!venda) {
    throw new Error(vendaId
      ? `Venda local #${vendaId} não encontrada.`
      : 'Nenhuma venda foi encontrada no banco local.');
  }
  venda.mensagem_teste = true;
  return venda;
}

async function testarVendas() {
  const venda = await carregarVendaLocal();
  const mensagens = telegramService._internals.montarMensagensVenda(venda);
  if (somenteVisualizar) return mensagens.join('\n\n===== PRÓXIMA MENSAGEM =====\n\n');
  exigirConfiguracao('TELEGRAM_VENDAS_CHAT_ID');
  const resultado = await telegramService.enviarVenda(venda);
  return `venda local #${venda.id} enviada em ${resultado.message_ids?.length || 0} mensagem(ns)`;
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

executar()
  .catch(error => {
    console.error(`Falha no teste do Telegram: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (conexaoBanco) await conexaoBanco.destroy();
  });
