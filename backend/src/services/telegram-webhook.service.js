const Usuario = require('../models/Usuario');
const db = require('../database/connection');
const notificacaoService = require('./notificacao.service');
const telegramService = require('./telegram.service');

function grupoAutorizado(chatId) {
  return String(chatId || '') === String(process.env.TELEGRAM_FUTUROS_CLIENTES_CHAT_ID || '').trim();
}
function callbackPartes(valor) { return String(valor || '').split(':'); }

function obterDadosLead(dadosJson) {
  try { return typeof dadosJson === 'string' ? JSON.parse(dadosJson) : (dadosJson || {}); } catch { return {}; }
}

function obterNomeEmpresa(dadosJson, linhaId) {
  const dados = obterDadosLead(dadosJson);
  const entrada = Object.entries(dados).find(([chave, valor]) => {
    const nome = String(chave || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return valor && ['razao social', 'empresa', 'nome fantasia', 'nome'].some(termo => nome.includes(termo));
  });
  return String(entrada?.[1] || `Futuro cliente #${linhaId}`).trim();
}

async function listarVendedoras() {
  return Usuario.query().select('id', 'nome').where('ativo', true).orderBy('nome', 'asc');
}
async function distribuir(linhaId, vendedoraId, gerenteTelegramId) {
  return db.transaction(async trx => {
    const linha = await trx('lead_linhas').where('id', linhaId).where('futuro_cliente', true).whereNull('futuro_cliente_excluido_em').first();
    if (!linha) throw new Error('Este futuro cliente nao esta mais disponivel.');
    if (linha.status_operacional === 'distribuido_venda' || linha.status_operacional === 'vendido' || linha.status_operacional === 'perdido') throw new Error('Este futuro cliente ja foi encaminhado.');
    const vendedora = await trx('usuarios').where({ id: vendedoraId, ativo: true }).first();
    if (!vendedora) throw new Error('Vendedora indisponivel.');
    const nomeEmpresa = obterNomeEmpresa(linha.dados_json, linhaId);
    const dadosLead = obterDadosLead(linha.dados_json);
    const resultadoEnvio = await trx('lead_envios').insert({
      nome: nomeEmpresa.slice(0, 240),
      total_linhas: 1,
      colunas_visiveis: JSON.stringify(Object.keys(dadosLead)),
      criado_por_id: null
    });
    const envioId = Number(Array.isArray(resultadoEnvio) ? resultadoEnvio[0] : resultadoEnvio);
    await trx('lead_envio_usuarios').insert({ envio_id: envioId, usuario_id: vendedoraId, quantidade: 1 });
    await trx('lead_linhas').where('id', linhaId).update({
      atribuido_para_id: vendedoraId,
      envio_id: envioId,
      etapa_atual: 'venda',
      status_operacional: 'distribuido_venda',
      updated_at: new Date()
    });
    await trx('lead_atribuicoes').insert({ lead_linha_id: linhaId, envio_id: envioId, usuario_id: vendedoraId, etapa: 'venda', status: 'atribuido', criado_por_id: null });
    await notificacaoService.criarNotificacaoFuturoClienteDistribuido({ leadLinhaId: linhaId, vendedoraId, gerenteTelegramId, nomeEmpresa }, trx);
    return vendedora;
  });
}
async function cancelarEnvio(linhaId) {
  return db.transaction(async trx => {
    const linha = await trx('lead_linhas')
      .where('id', linhaId)
      .where('futuro_cliente', true)
      .whereNull('futuro_cliente_excluido_em')
      .first();
    if (!linha) throw new Error('Este futuro cliente nao esta mais disponivel.');
    if (linha.status_operacional !== 'distribuido_venda' || !linha.envio_id) {
      throw new Error('Este futuro cliente nao possui um envio que possa ser cancelado.');
    }

    const envioId = Number(linha.envio_id);
    const atribuicaoSondagem = await trx('lead_atribuicoes')
      .where({ lead_linha_id: linhaId, etapa: 'sondagem' })
      .orderBy('id', 'desc')
      .first();

    await trx('lead_atribuicoes')
      .where({ lead_linha_id: linhaId, envio_id: envioId, etapa: 'venda' })
      .delete();
    await trx('lead_envios').where('id', envioId).delete();
    await trx('lead_linhas').where('id', linhaId).update({
      envio_id: atribuicaoSondagem?.envio_id || null,
      atribuido_para_id: atribuicaoSondagem?.usuario_id || null,
      etapa_atual: 'sondagem',
      status_operacional: 'qualificado',
      updated_at: new Date()
    });
    await trx('notificacoes')
      .where('source_key', `futuro_cliente_distribuido:${linhaId}`)
      .update({ ativa: false, updated_at: new Date() });
  });
}
async function processarCallback(query) {
  const telegramId = query?.from?.id;
  if (!grupoAutorizado(query?.message?.chat?.id)) return telegramService.chamarApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Este grupo nao pode encaminhar futuros clientes.', show_alert: true });
  const [, acao, linhaId, vendedoraId] = callbackPartes(query.data);
  if (acao === 'selecionar') {
    const vendedoras = await listarVendedoras();
    await telegramService.chamarApi('editMessageReplyMarkup', { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: vendedoras.map(v => [{ text: v.nome, callback_data: `fc:atribuir:${linhaId}:${v.id}` }]) } });
    return telegramService.chamarApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Selecione a vendedora.' });
  }
  if (acao === 'atribuir') {
    const vendedora = await distribuir(Number(linhaId), Number(vendedoraId), telegramId);
    await telegramService.chamarApi('editMessageReplyMarkup', { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [[{ text: `Cancelar envio ${vendedora.nome}`, callback_data: `fc:cancelar:${linhaId}` }]] } });
    return telegramService.chamarApi('answerCallbackQuery', { callback_query_id: query.id, text: `Encaminhado para ${vendedora.nome}.` });
  }
  if (acao === 'cancelar') {
    await cancelarEnvio(Number(linhaId));
    await telegramService.chamarApi('editMessageReplyMarkup', { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Encaminhar', callback_data: `fc:selecionar:${linhaId}` }]] } });
    return telegramService.chamarApi('answerCallbackQuery', { callback_query_id: query.id, text: 'Envio cancelado. O futuro cliente pode ser encaminhado novamente.' });
  }
  return null;
}
async function receberWebhook(req, res) {
  const segredo = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
  if (segredo && req.get('X-Telegram-Bot-Api-Secret-Token') !== segredo) return res.sendStatus(401);
  res.sendStatus(200);
  if (req.body?.callback_query) processarCallback(req.body.callback_query).catch(error => console.error('Erro ao processar callback do Telegram:', error.message));
}
module.exports = { receberWebhook, processarCallback, distribuir, cancelarEnvio };
