const app = require('./app');
const db = require('./config/database');
const { iniciarAplicacao } = require('./startup');
const vendaArquivoService = require('./services/venda-arquivo.service');
const arquivoService = require('./services/arquivo.service');
const resumoVendasTelegramService = require('./services/resumo-vendas-telegram.service');
const notificacaoService = require('./services/notificacao.service');

const PORT = process.env.APP_PORT || 3000;

/**
 * Limpa arquivos vencidos e restaura o estado inicial.
 */
function limparArquivosVencidos() {
  vendaArquivoService.limparArquivosIndividuaisVencidos()
    .catch(error => {
      console.error('Erro ao limpar arquivos individuais vencidos:', error);
    });

  // Apaga blobs sem nenhum vínculo (ex.: upload pelo chat que o usuário não chegou a enviar).
  arquivoService.limparArquivosOrfaos()
    .catch(error => {
      console.error('Erro ao limpar arquivos orfaos:', error);
    });
}

/**
 * Mantem alertas baseados em prazo atualizados sem bloquear as consultas da interface.
 */
let sincronizandoNotificacoes = false;

function sincronizarNotificacoesPendentes() {
  if (sincronizandoNotificacoes) return;

  sincronizandoNotificacoes = true;
  notificacaoService.sincronizarNotificacoesPendentes()
    .catch(error => {
      console.error('Erro ao sincronizar notificacoes pendentes:', error);
    })
    .finally(() => {
      sincronizandoNotificacoes = false;
    });
}

function iniciarAgendamentos() {
  setTimeout(limparArquivosVencidos, 60 * 1000);
  setInterval(limparArquivosVencidos, 24 * 60 * 60 * 1000);
  resumoVendasTelegramService.iniciarAgendamentoResumoVendas();

  setTimeout(sincronizarNotificacoesPendentes, 5000);
  setInterval(sincronizarNotificacoesPendentes, 30 * 1000);
}

iniciarAplicacao({
  app,
  db,
  port: PORT,
  iniciarAgendamentos
}).catch(async error => {
  console.error('Falha ao iniciar o servidor:', error);

  try {
    await db.destroy();
  } catch (destroyError) {
    console.error('Falha ao encerrar a conexao com o banco:', destroyError);
  }

  process.exitCode = 1;
});
