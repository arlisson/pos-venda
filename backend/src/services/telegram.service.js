const axios = require('axios');

const TELEGRAM_API_URL = 'https://api.telegram.org';

function tokenConfigurado() {
  return String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

async function chamarApi(metodo, dados) {
  const token = tokenConfigurado();
  if (!token) return null;
  const resposta = await axios.post(`${TELEGRAM_API_URL}/bot${token}/${metodo}`, dados, { timeout: 10000 });
  if (!resposta.data?.ok) throw new Error(resposta.data?.description || 'O Telegram recusou a solicitacao.');
  return resposta.data.result;
}

function formatarMoeda(valor) {
  const número = Number(valor);
  if (!Number.isFinite(número)) return 'Não informado';
  return número.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataHora(valor) {
  if (!valor) return 'Não informado';
  const texto = String(valor);
  const dataSemHora = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dataSemHora) return `${dataSemHora[3]}/${dataSemHora[2]}/${dataSemHora[1]}`;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(data);
}

function montarMensagemFuturoCliente(linha = {}) {
  const sondagem = linha.sondagem || {};
  const telefone = [sondagem.whatsapp_ddd, sondagem.whatsapp_numero].filter(Boolean).join('');
  const formatarTelefone = número => {
    if (!número) return 'Não informado';
    const digitos = String(número).replace(/\D/g, '');
    const inicioNumero = digitos.length === 11 ? 7 : 6;
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, inicioNumero)}-${digitos.slice(inicioNumero)}`;
  };
  const itensChips = Array.isArray(sondagem.chips_itens) ? sondagem.chips_itens : [];
  const descricaoChips = itensChips.length ? itensChips.map(item => `${item.quantidade}x ${formatarMoeda(item.preco_por_chip)}`).join(', ') : `${sondagem.quantidade_chips || 0} chip(s)`;
  const tipoContato = sondagem.contato_tipo === 'adm' ? 'ADM' : (sondagem.contato_tipo === 'rl' ? 'RL' : 'Não informado');
  return [
    '📌 NOVO FUTURO CLIENTE', '', `Primeira ligação: ${sondagem.usuario?.nome || 'Não informado'}`, '',
    `Empresa: ${sondagem.razao_social || 'Não informada'}`, `CNPJ: ${sondagem.cnpj || 'Não informado'}`,
    `Contato: ${sondagem.contato_nome || 'Não informado'} (${tipoContato})`, `Melhor número para contato: ${formatarTelefone(sondagem.melhor_numero_contato)}`,
    `WhatsApp: ${formatarTelefone(telefone)}`, `Operadora atual: ${sondagem.operadoraAtual?.nome || 'Não informada'}`,
    `Chips atuais: ${descricaoChips}`, `Valor mensal estimado: ${formatarMoeda(sondagem.valor_mensal_estimado)}`,
    `Fixo: ${formatarTelefone(sondagem.telefone_fixo)}`, `Terminal: ${formatarTelefone(sondagem.terminal)}`,
    `Data da ativacao: ${formatarDataHora(sondagem.data_ativacao)}`,
    `Operadora de interesse: ${sondagem.operadoraInteresse?.nome || 'Nao informada'}`,
    
    `Data do contato: ${formatarDataHora(sondagem.respondido_em || linha.futuro_cliente_marcado_em)}`,
    `Retorno: ${formatarDataHora(sondagem.retorno_em || linha.futuro_cliente_retorno)}`, `Observações: ${sondagem.observacoes || 'Nenhuma'}`
  ].join('\n');
}

async function enviarFuturoCliente(linha) {
  const chatId = String(process.env.TELEGRAM_FUTUROS_CLIENTES_CHAT_ID || '').trim();
  if (!tokenConfigurado() || !chatId) return { enviado: false, motivo: 'telegram_nao_configurado' };
  const resultado = await chamarApi('sendMessage', {
    chat_id: chatId,
    text: montarMensagemFuturoCliente(linha),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: 'Encaminhar', callback_data: `fc:selecionar:${linha.id}` }]] }
  });
  return { enviado: true, message_id: resultado?.message_id || null };
}

module.exports = { enviarFuturoCliente, chamarApi, _internals: { formatarDataHora, formatarMoeda, montarMensagemFuturoCliente } };
