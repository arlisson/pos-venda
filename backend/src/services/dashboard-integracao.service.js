/**
 * Sincroniza vendas do CRM com o dashboard externo.
 *
 * Uma venda do CRM pode ter chips com vendedoras, operadoras e tipos diferentes.
 * Cada chip vira um lançamento idempotente próprio no dashboard.
 */
const axios = require('axios');
const Venda = require('../models/Venda');

const NOME_TABELA = 'dashboard_integracao_vendas';
const CACHE_REFERENCIAS_MS = 5 * 60 * 1000;
const LIMITE_REQUISICOES_POR_MINUTO = 120;
let cacheReferencias = null;
let filaEnvios = Promise.resolve();
let inicioJanelaRequisicoes = Date.now();
let requisicoesNaJanela = 0;

async function reservarRequisicao() {
  while (true) {
    const agora = Date.now();
    const decorrido = agora - inicioJanelaRequisicoes;
    if (decorrido >= 60 * 1000) { inicioJanelaRequisicoes = agora; requisicoesNaJanela = 0; }
    if (requisicoesNaJanela < LIMITE_REQUISICOES_POR_MINUTO) { requisicoesNaJanela += 1; return; }
    await new Promise(resolve => setTimeout(resolve, Math.max(1, 60 * 1000 - decorrido)));
  }
}

function configuracao() {
  const baseUrl = String(process.env.DASHBOARD_INTEGRATION_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.DASHBOARD_INTEGRATION_API_KEY || '').trim();
  return { baseUrl, apiKey };
}

function estaConfigurada() { const { baseUrl, apiKey } = configuracao(); return Boolean(baseUrl && apiKey); }
function normalizarTexto(valor) { return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function somenteDigitos(valor) { return String(valor || '').replace(/\D/g, ''); }
function valorBooleano(valor) { return valor === true || valor === 1 || valor === '1'; }
function obterNomeReferencia(item) { return item?.full_name || item?.name || item?.nome || item?.label || item?.title || ''; }
function obterColecaoReferencias(referencias, chave) { const raiz = referencias?.data || referencias || {}; return Array.isArray(raiz[chave]) ? raiz[chave] : []; }

function obterMapaConfigurado(chave) {
  const valor = process.env[`DASHBOARD_INTEGRATION_${chave.toUpperCase()}_MAP`];
  if (!valor) return {};
  try { const mapa = JSON.parse(valor); return mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? mapa : {}; }
  catch { throw new Error(`A variavel DASHBOARD_INTEGRATION_${chave.toUpperCase()}_MAP deve conter JSON valido.`); }
}

function resolverIdReferencia({ referencias, colecao, chaveMapa, referenciaLocal }) {
  const mapa = obterMapaConfigurado(chaveMapa);
  const configurado = mapa[String(referenciaLocal?.id)];
  if (configurado !== undefined && configurado !== null && String(configurado).trim() !== '') return Number(configurado);
  const opcoes = obterColecaoReferencias(referencias, colecao);
  const nome = normalizarTexto(referenciaLocal?.nome);
  const correspondenciaPorNome = opcoes.find(item => normalizarTexto(obterNomeReferencia(item)) === nome);
  const correspondenciaPorId = opcoes.find(item => Number(item?.id) === Number(referenciaLocal?.id));
  const correspondencia = correspondenciaPorNome || correspondenciaPorId;
  if (!correspondencia?.id) throw new Error(`Nao foi encontrada referencia ativa no dashboard para ${chaveMapa} "${referenciaLocal?.nome || referenciaLocal?.id || 'nao informado'}".`);
  return Number(correspondencia.id);
}

function formatarDataHoraVenda(venda) {
  const saleDate = String(venda.data_venda || venda.criado_em || venda.created_at || '').slice(0, 10);
  const hora = String(venda.criado_em || venda.created_at || '').match(/(?:T|\s)(\d{2}:\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) throw new Error('A venda nao possui uma data valida para enviar ao dashboard.');
  return { sale_date: saleDate, sale_time: hora?.[1] || '00:00' };
}

function normalizarChips(valor) {
  if (Array.isArray(valor)) return valor.filter(item => item && typeof item === 'object');
  if (!String(valor || '').trim()) return [];
  try { const itens = JSON.parse(valor); return Array.isArray(itens) ? itens.filter(item => item && typeof item === 'object') : []; }
  catch { return []; }
}

function itensSincronizacao(venda) {
  const chips = normalizarChips(venda.valores_unitarios_chips);
  return chips.length ? chips.map((_chip, index) => `chip-${index + 1}`) : ['principal'];
}

function chipDaVenda(venda, itemKey) {
  const match = /^chip-(\d+)$/.exec(String(itemKey || ''));
  if (!match) return null;
  return normalizarChips(venda._dashboardIntegration?.chips || venda.valores_unitarios_chips)[Number(match[1]) - 1] || null;
}

function resolverTipoVendaDoChip(chip, referencias) {
  const tipo = normalizarTexto(chip?.tipo_linha || chip?.tipo || chip?.categoria);
  const codigo = tipo === 'novo' ? 'new' : tipo === 'portabilidade' ? 'portability' : null;
  const referencia = obterColecaoReferencias(referencias, 'sale_types').find(item => item.code === codigo);
  if (!referencia?.id) throw new Error(`Nao foi encontrado tipo de venda ativo no dashboard para o chip "${tipo || 'nao informado'}".`);
  return Number(referencia.id);
}

function referenciaDoChip(venda, chip, tipo) {
  if (!chip) return venda[tipo];
  const dados = venda._dashboardIntegration || {};
  if (tipo === 'vendedora') return dados.vendedorasPorId?.[Number(chip.vendedora_id)] || venda.vendedora;
  if (tipo === 'operadora') return dados.operadorasPorId?.[Number(chip.operadora_id)] || venda.operadora;
  return venda[tipo];
}

function valorMonetario(valor, mensagem) {
  const numero = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) throw new Error(mensagem);
  return numero.toFixed(2);
}

function montarPayloadVenda(venda, referencias, itemKey = 'principal') {
  const { sale_date, sale_time } = formatarDataHoraVenda(venda);
  const chip = chipDaVenda(venda, itemKey);
  const quantidade = Number(chip?.quantidade ?? venda.quantidade_linhas ?? 0);
  if (!Number.isInteger(quantidade) || quantidade < 1) throw new Error('A venda nao possui uma quantidade valida para enviar ao dashboard.');
  const unitValue = chip
    ? valorMonetario(chip.valor_unitario, 'O chip nao possui um valor unitario valido para enviar ao dashboard.')
    : valorMonetario(Number(venda.valor_total || 0) / quantidade, 'A venda nao possui um valor valido para enviar ao dashboard.');
  const vendedora = referenciaDoChip(venda, chip, 'vendedora');
  const operadora = referenciaDoChip(venda, chip, 'operadora');

  return {
    external_sale_id: itemKey === 'principal' ? `crm-venda-${venda.id}` : `crm-venda-${venda.id}-${itemKey}`,
    seller_id: resolverIdReferencia({ referencias, colecao: 'sellers', chaveMapa: 'seller', referenciaLocal: vendedora }),
    service_id: resolverIdReferencia({ referencias, colecao: 'services', chaveMapa: 'service', referenciaLocal: venda.servico }),
    operator_id: resolverIdReferencia({ referencias, colecao: 'operators', chaveMapa: 'operator', referenciaLocal: operadora }),
    sale_type_id: chip ? resolverTipoVendaDoChip(chip, referencias) : resolverIdReferencia({ referencias, colecao: 'sale_types', chaveMapa: 'sale_type', referenciaLocal: venda.tipoVenda }),
    sale_date,
    sale_time,
    cnpj: somenteDigitos(venda.cnpj),
    company_name: venda.razao_social || venda.nome,
    phone: somenteDigitos(venda.telefone),
    closed_by_name: venda.nome_fechou_venda || vendedora?.nome || '',
    quantity: quantidade,
    unit_value: unitValue,
    has_doc: valorBooleano(venda.possui_doc_na_casa),
    is_base_sale: valorBooleano(venda.cliente_da_base),
    // String vazia é aceita tanto pelo dashboard atual quanto pelo que aceita null.
    notes: venda.observacoes || ''
  };
}

async function obterReferencias({ atualizar = false } = {}) {
  if (!estaConfigurada()) throw new Error('A integracao com o dashboard nao esta configurada.');
  if (!atualizar && cacheReferencias && Date.now() - cacheReferencias.em < CACHE_REFERENCIAS_MS) return cacheReferencias.valor;
  const { baseUrl, apiKey } = configuracao();
  await reservarRequisicao();
  const resposta = await axios.get(`${baseUrl}/api/v1/integration/references`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 });
  cacheReferencias = { valor: resposta.data, em: Date.now() };
  return resposta.data;
}

async function registrarVendaPendente(venda, trx) {
  if (!estaConfigurada()) return;
  const vendaId = Number(typeof venda === 'object' ? venda.id : venda);
  const itens = typeof venda === 'object' ? itensSincronizacao(venda) : ['principal'];
  for (const itemKey of itens) {
    const existe = await trx(NOME_TABELA).where({ venda_id: vendaId, item_key: itemKey }).first();
    if (!existe) await trx(NOME_TABELA).insert({ venda_id: vendaId, item_key: itemKey, status: 'pendente' });
  }
}

async function obterVendaParaEnvio(vendaId) {
  const venda = await Venda.query().findById(vendaId).withGraphFetched('[vendedora, servico, operadora, tipoVenda]');
  if (!venda) return null;
  const chips = normalizarChips(venda.valores_unitarios_chips);
  const idsVendedoras = [...new Set(chips.map(chip => Number(chip.vendedora_id)).filter(Number.isInteger))];
  const idsOperadoras = [...new Set(chips.map(chip => Number(chip.operadora_id)).filter(Number.isInteger))];
  const knex = Venda.knex();
  const [vendedoras, operadoras] = await Promise.all([
    idsVendedoras.length ? knex('usuarios').whereIn('id', idsVendedoras).select('id', 'nome') : [],
    idsOperadoras.length ? knex('operadoras').whereIn('id', idsOperadoras).select('id', 'nome') : []
  ]);
  venda._dashboardIntegration = {
    chips,
    vendedorasPorId: Object.fromEntries(vendedoras.map(item => [Number(item.id), item])),
    operadorasPorId: Object.fromEntries(operadoras.map(item => [Number(item.id), item]))
  };
  return venda;
}

function mensagemErro(error) {
  const erroApi = error.response?.data?.error;
  const detalhe = erroApi?.message || error.response?.data?.message || erroApi || error.message;
  const campos = erroApi?.fieldErrors && typeof erroApi.fieldErrors === 'object'
    ? ` (${Object.entries(erroApi.fieldErrors).map(([campo, mensagem]) => `${campo}: ${mensagem}`).join('; ')})`
    : '';
  return `${String(detalhe || 'Falha desconhecida ao enviar venda ao dashboard.')}${campos}`.slice(0, 4000);
}

async function expandirPendenciaLegada(venda, pendencia) {
  if (pendencia.item_key !== 'principal') return false;
  const itens = itensSincronizacao(venda);
  if (itens.length === 1 && itens[0] === 'principal') return false;
  const knex = Venda.knex();
  await knex.transaction(async trx => {
    const atual = await trx(NOME_TABELA).where({ id: pendencia.id, status: 'pendente', item_key: 'principal' }).first();
    if (!atual) return;
    await trx(NOME_TABELA).where({ id: atual.id }).delete();
    for (const itemKey of itens) await trx(NOME_TABELA).insert({ venda_id: Number(venda.id), item_key: itemKey, status: 'pendente' });
  });
  return true;
}

async function enviarVendaPendente(vendaId, itemKey = 'principal') {
  if (!estaConfigurada()) return { ignorada: true };
  const knex = Venda.knex();
  const pendencia = await knex(NOME_TABELA).where({ venda_id: Number(vendaId), item_key: itemKey }).first();
  if (!pendencia || pendencia.status === 'enviada') return { ignorada: true };
  try {
    const venda = await obterVendaParaEnvio(vendaId);
    if (!venda) throw new Error('Venda nao encontrada para sincronizacao.');
    if (await expandirPendenciaLegada(venda, pendencia)) return { reagrupada: true };
    const referencias = await obterReferencias();
    const payload = montarPayloadVenda(venda, referencias, itemKey);
    const { baseUrl, apiKey } = configuracao();
    await reservarRequisicao();
    const resposta = await axios.post(`${baseUrl}/api/v1/integration/sales`, payload, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 });
    await knex(NOME_TABELA).where({ venda_id: Number(vendaId), item_key: itemKey }).update({ status: 'enviada', tentativas: Number(pendencia.tentativas || 0) + 1, ultimo_erro: null, dashboard_sale_id: resposta.data?.data?.id || null, enviada_em: knex.fn.now(), ultima_tentativa_em: knex.fn.now(), updated_at: knex.fn.now() });
    return { enviada: true, idempotente: resposta.data?.idempotent === true };
  } catch (error) {
    await knex(NOME_TABELA).where({ venda_id: Number(vendaId), item_key: itemKey }).update({ status: 'pendente', tentativas: Number(pendencia.tentativas || 0) + 1, ultimo_erro: mensagemErro(error), ultima_tentativa_em: knex.fn.now(), updated_at: knex.fn.now() });
    throw error;
  }
}

async function enviarPendentesDaVenda(vendaId) {
  const pendencias = await Venda.knex()(NOME_TABELA).where({ venda_id: Number(vendaId), status: 'pendente' }).orderBy('id').select('item_key');
  for (const pendencia of pendencias) await enviarVendaPendente(vendaId, pendencia.item_key);
}

function agendarEnvioVenda(vendaId) {
  if (!estaConfigurada()) return;
  filaEnvios = filaEnvios.catch(() => undefined).then(() => enviarPendentesDaVenda(vendaId)).catch(error => console.error(`Erro ao sincronizar venda ${vendaId} com o dashboard:`, mensagemErro(error)));
}

async function sincronizarPendentes({ limite = 120 } = {}) {
  if (!estaConfigurada()) return { ignoradas: true, total: 0 };
  const pendentes = await Venda.knex()(NOME_TABELA).where('status', 'pendente').orderBy('id', 'asc').limit(Math.min(Math.max(Number(limite) || 1, 1), 120)).select('venda_id', 'item_key');
  for (const pendencia of pendentes) {
    try { await enviarVendaPendente(pendencia.venda_id, pendencia.item_key); }
    catch (error) { console.error(`Erro ao reenviar venda ${pendencia.venda_id} (${pendencia.item_key}) ao dashboard:`, mensagemErro(error)); }
  }
  return { total: pendentes.length };
}

module.exports = { agendarEnvioVenda, enviarVendaPendente, estaConfigurada, montarPayloadVenda, registrarVendaPendente, resolverIdReferencia, sincronizarPendentes, _internals: { chipDaVenda, formatarDataHoraVenda, itensSincronizacao, mensagemErro, normalizarChips, normalizarTexto, somenteDigitos, resolverTipoVendaDoChip } };
