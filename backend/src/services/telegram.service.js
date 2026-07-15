const axios = require('axios');

const TELEGRAM_API_URL = 'https://api.telegram.org';

/** Formata valor monetario para a notificacao enviada ao Telegram. */
function formatarMoeda(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'N\u00E3o informado';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata data/hora para leitura no grupo de notificacoes. */
function formatarDataHora(valor) {
  if (!valor) return 'N\u00E3o agendado';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(data);
}

/** Monta o texto da notificacao de um futuro cliente. */
function montarMensagemFuturoCliente(linha = {}) {
  const sondagem = linha.sondagem || {};
  const telefone = [sondagem.whatsapp_ddd, sondagem.whatsapp_numero].filter(Boolean).join('');
  const whatsapp = telefone
    ? `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`
    : 'N\u00E3o informado';
  const itensChips = Array.isArray(sondagem.chips_itens) ? sondagem.chips_itens : [];
  const descricaoChips = itensChips.length
    ? itensChips.map(item => `${item.quantidade}x ${formatarMoeda(item.preco_por_chip)}`).join(', ')
    : `${sondagem.quantidade_chips || 0} chip(s)`;
  const tipoContato = sondagem.contato_tipo === 'adm' ? 'ADM' : (sondagem.contato_tipo === 'rl' ? 'RL' : 'N\u00E3o informado');

  return [
    '\u{1F4CC} NOVO FUTURO CLIENTE', '',
    `Primeira liga\u00E7\u00E3o: ${sondagem.usuario?.nome || 'N\u00E3o informado'}`,'',
    `Empresa: ${sondagem.razao_social || 'N\u00E3o informada'}`,
    `CNPJ: ${sondagem.cnpj || 'N\u00E3o informado'}`,
    `Contato: ${sondagem.contato_nome || 'N\u00E3o informado'} (${tipoContato})`,
    `WhatsApp: ${whatsapp}`,
    `Operadora atual: ${sondagem.operadoraAtual?.nome || 'N\u00E3o informada'}`,
    `Chips: ${descricaoChips}`,
    `Valor mensal estimado: ${formatarMoeda(sondagem.valor_mensal_estimado)}`,
    `Retorno: ${formatarDataHora(sondagem.retorno_em || linha.futuro_cliente_retorno)}`,  
    `Observa\u00E7\u00F5es: ${sondagem.observacoes || 'Nenhuma'}`
  ].join('\n');
}

/** Envia a notificacao de futuro cliente ao grupo configurado no Telegram. */
async function enviarFuturoCliente(linha) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_FUTUROS_CLIENTES_CHAT_ID || '').trim();
  if (!token || !chatId) return { enviado: false, motivo: 'telegram_nao_configurado' };

  const resposta = await axios.post(`${TELEGRAM_API_URL}/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: montarMensagemFuturoCliente(linha),
    disable_web_page_preview: true
  }, { timeout: 10000 });

  if (!resposta.data?.ok) throw new Error(resposta.data?.description || 'O Telegram recusou o envio da mensagem.');
  return { enviado: true, message_id: resposta.data.result?.message_id || null };
}

module.exports = { enviarFuturoCliente, _internals: { formatarDataHora, formatarMoeda, montarMensagemFuturoCliente } };
