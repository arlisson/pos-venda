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

function formatarTelefone(numero) {
  if (!numero) return 'Não informado';
  const digitos = String(numero).replace(/\D/g, '');
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  return String(numero);
}

function obterChatId(nomeVariavel) {
  return String(process.env[nomeVariavel] || '').trim();
}

function normalizarItensChips(valor) {
  if (Array.isArray(valor)) return valor;
  if (!valor) return [];
  try {
    const itens = JSON.parse(valor);
    return Array.isArray(itens) ? itens : [];
  } catch {
    return [];
  }
}

function montarDescricaoChips(venda) {
  const itens = normalizarItensChips(venda.valores_unitarios_chips);
  if (!itens.length) return `${venda.quantidade_linhas || 0} linha(s)`;
  return itens.map(item => {
    const detalhes = [
      `${item.quantidade || 0}x`,
      item.gb ? `${item.gb} GB` : null,
      item.tipo_linha ? String(item.tipo_linha) : null,
      formatarMoeda(item.valor_unitario)
    ].filter(Boolean);
    return detalhes.join(' · ');
  }).join('\n');
}

function montarMensagemVenda(venda = {}) {
  const veioDaPrimeiraLigacao = Boolean(venda.origem_lead_linha_id);
  const vendedoras = Array.isArray(venda.vendedoras) && venda.vendedoras.length
    ? venda.vendedoras.map(item => item.nome).filter(Boolean).join(', ')
    : (venda.vendedora?.nome || 'Não informado');
  const produto = venda.tipoProduto?.nome || venda.produto_fechado || 'Não informado';
  const linhas = [
    venda.mensagem_teste ? '🧪 TESTE — NOVA VENDA (DADOS FICTÍCIOS)' : '✅ NOVA VENDA CADASTRADA',
    '',
    veioDaPrimeiraLigacao
      ? '📞 ORIGEM: SONDAGEM DA PRIMEIRA LIGAÇÃO'
      : 'Origem: Cadastro direto',
    ...(veioDaPrimeiraLigacao
      ? [`Primeira ligação realizada por: ${venda.origemSondador?.nome || 'Não informado'}`]
      : []),
    '',
    `Venda: #${venda.id || 'Não informado'}`,
    `Cliente: ${venda.nome || 'Não informado'}`,
    `Razão social: ${venda.razao_social || 'Não informada'}`,
    `CNPJ/CPF: ${venda.cnpj || 'Não informado'}`,
    `Contato: ${formatarTelefone(venda.telefone)}`,
    `E-mail: ${venda.email || 'Não informado'}`,
    `Vendedora(s): ${vendedoras}`,
    `Cadastrada por: ${venda.criador?.nome || 'Não informado'}`,
    `Operadora: ${venda.operadora?.nome || 'Não informada'}`,
    `Produto: ${produto}`,
    `Tipo de venda: ${venda.tipoVenda?.nome || 'Não informado'}`,
    `Serviço: ${venda.servico?.nome || 'Não informado'}`,
    `Quantidade de linhas: ${venda.quantidade_linhas || 0}`,
    `Chips:\n${montarDescricaoChips(venda)}`,
    `Valor total: ${formatarMoeda(venda.valor_total)}`,
    `Data da venda: ${formatarDataHora(venda.data_venda || venda.criado_em || venda.created_at)}`,
    `Protocolo: ${venda.protocolo || 'Não informado'}`,
    `Observações: ${venda.observacoes || 'Nenhuma'}`
  ];
  return linhas.join('\n').slice(0, 4096);
}

function montarMensagemFuturoCliente(linha = {}) {
  const sondagem = linha.sondagem || {};
  const telefone = [sondagem.whatsapp_ddd, sondagem.whatsapp_numero].filter(Boolean).join('');
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
  const chatId = obterChatId('TELEGRAM_FUTUROS_CLIENTES_CHAT_ID');
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

async function enviarResumoVendas(texto) {
  const chatId = obterChatId('TELEGRAM_RESUMO_VENDAS_CHAT_ID');
  if (!tokenConfigurado() || !chatId) return { enviado: false, motivo: 'telegram_nao_configurado' };
  const resultado = await chamarApi('sendMessage', { chat_id: chatId, text: String(texto || ''), disable_web_page_preview: true });
  return { enviado: true, message_id: resultado?.message_id || null };
}

async function enviarVenda(venda) {
  const chatId = obterChatId('TELEGRAM_VENDAS_CHAT_ID');
  if (!tokenConfigurado() || !chatId) return { enviado: false, motivo: 'telegram_nao_configurado' };
  const resultado = await chamarApi('sendMessage', {
    chat_id: chatId,
    text: montarMensagemVenda(venda),
    disable_web_page_preview: true
  });
  return { enviado: true, message_id: resultado?.message_id || null };
}

module.exports = {
  enviarFuturoCliente,
  enviarResumoVendas,
  enviarVenda,
  chamarApi,
  _internals: {
    formatarDataHora,
    formatarMoeda,
    formatarTelefone,
    montarMensagemFuturoCliente,
    montarMensagemVenda,
    obterChatId
  }
};
