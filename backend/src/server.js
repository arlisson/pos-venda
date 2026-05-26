const app = require('./app');
const vendaArquivoService = require('./services/venda-arquivo.service');
const arquivoService = require('./services/arquivo.service');

const PORT = process.env.APP_PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

server.requestTimeout = 30 * 60 * 1000;
server.headersTimeout = 31 * 60 * 1000;

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

setTimeout(limparArquivosVencidos, 60 * 1000);
setInterval(limparArquivosVencidos, 24 * 60 * 60 * 1000);
