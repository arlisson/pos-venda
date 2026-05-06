import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import {
  atualizarVenda,
  baixarXlsxClaro,
  criarVenda,
  deletarVenda,
  gerarEmailVenda,
  listarVendas,
  listarVendedoras
} from '../../services/venda.service';
import { consultarCnpj, isCnpjRepetido, sanitizarCnpj } from '../../services/cnpj.service';
import { listarEtapasFunil, listarOperadoras, listarServicos, listarTiposVenda } from '../../services/config.service';
import { listarClientes } from '../../services/cliente.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import './VendasPage.css';

const VENDA_VAZIA = {
  cliente_id: '',
  nome: '',
  telefone: '',
  email: '',
  email_2: '',
  fixo_ddd: '',
  razao_social: '',
  cnpj: '',
  // Representante Legal
  nome_representante_legal: '',
  cpf_representante_legal: '',
  telefone_representante_legal: '',
  email_representante_legal: '',
  // Administrador
  nome_administrador: '',
  cpf_administrador: '',
  telefone_administrador: '',
  email_administrador: '',
  // Dados da venda
  nome_fechou_venda: '',
  setor_funcao: '',
  produto_fechado: '',
  qc_feito_por: '',
  data_venda: '',
  // Produto e valores
  tipo_venda_id: '',
  servico_id: '',
  quantidade_linhas: '',
  ddd: '',
  gb: '',
  valores_unitarios_chips: '',
  valor_total: '',
  ponto_referencia: '',
  tipo_local_cpf: '',
  razao_social: '',
  cnpj: '',
  data_venda: '',
  data_ativacao: '',
  qc_feito_por: '',
  observacoes: '',
  dia_vencimento: '',
  // Endereço
  cep: '',
  endereco: '',
  numero_endereco: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  ponto_referencia: '',
  tipo_local_cpf: '',
  // Aceite e recebimento
  horario_aceite_voz: '',
  horario_aceite_inicio: '',
  horario_aceite_fim: '',
  dia_aceite_inicio: '',
  dia_aceite_fim: '',
  protocolo: '',
  login: '',
  senha: '',
  responsavel_recebimento: '',
  rg_responsavel_recebimento: '',
  responsavel_recebimento_2: '',
  rg_responsavel_recebimento_2: '',
  responsavel_recebimento_3: '',
  rg_responsavel_recebimento_3: '',
  observacoes: '',
  // Referências
  operadora_id: '',
  vendedora_id: '',
  vendedoras: []
};

const ITEM_CHIP_VAZIO = { quantidade: '', gb: '', valor_unitario: '', tipo_linha: 'novo', vendedora_id: '' };
const NUMERO_PORTADO_VAZIO = '';
const TIPOS_LINHA_CHIP = [
  { value: 'novo', label: 'Novo' },
  { value: 'portabilidade', label: 'Port.' }
];

const DIAS_SEMANA = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const CAMPOS = [
  { section: 'Cliente' },
  { name: 'cliente_id', label: 'Cliente', type: 'client', required: true, span: true },
  { name: 'cnpj', label: 'CNPJ para preencher dados', type: 'cnpj' },
  { name: 'vendedoras', label: 'Vendedoras', type: 'sellers', span: true },

  { section: 'Dados do cliente' },
  { name: 'nome', label: 'Nome / Fantasia' },
  { name: 'razao_social', label: 'Razão Social' },
  { name: 'telefone', label: 'Celular' },
  { name: 'fixo_ddd', label: 'Telefone fixo' },
  { section: 'Representante Legal (RL)' },
  { name: 'nome_representante_legal', label: 'Nome RL' },
  { name: 'cpf_representante_legal', label: 'CPF RL' },
  { name: 'telefone_representante_legal', label: 'Telefone RL' },
  { name: 'email_representante_legal', label: 'Email RL' },

  { section: 'Administrador (ADM)' },
  { name: 'nome_administrador', label: 'Nome ADM' },
  { name: 'cpf_administrador', label: 'CPF ADM' },
  { name: 'telefone_administrador', label: 'Telefone ADM' },
  { name: 'email_administrador', label: 'E-mail ADM' },

  { section: 'Dados da venda' },
  { name: 'data_venda', label: 'Data da venda', type: 'date' },
  { name: 'data_ativacao', label: 'Data da ativacao', type: 'date' },
  { name: 'nome_fechou_venda', label: 'Nome com quem fechou a venda' },
  { name: 'setor_funcao', label: 'Setor/Função' },
  { name: 'qc_feito_por', label: 'QC feito por' },

  { section: 'Produto e valores' },
  { name: 'operadora_id', label: 'Operadora adquirida', type: 'operator', required: true },
  { name: 'servico_id', label: 'Produto', type: 'service', required: true },
  { name: 'quantidade_linhas', label: 'Quantidade de linhas fechadas', type: 'number' },
  { name: 'ddd', label: 'Qual DDD' },
  { name: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', min: 1, max: 31 },
  { name: 'valores_unitarios_chips', label: 'Chips, gigas e valores unitários', type: 'chips', span: true },
  { name: 'numeros_portados', label: 'Números a serem portados', type: 'portedNumbers', span: true },

  { section: 'Local de instalação/entrega' },
  { name: 'cep', label: 'CEP' },
  { name: 'endereco', label: 'Endereço', type: 'longText' },
  { name: 'numero_endereco', label: 'Número' },
  { name: 'complemento', label: 'Complemento', type: 'longText' },
  { name: 'bairro', label: 'Bairro' },
  { name: 'municipio', label: 'Município' },
  { name: 'uf', label: 'UF', maxLength: 2 },
  { name: 'ponto_referencia', label: 'Ponto de referência', type: 'longText', span: true },
  { name: 'tipo_local_cpf', label: 'Venda CPF: casa, hotel, condomínio, shopping...', type: 'longText', span: true },

  { section: 'Aceite e recebimento' },
  { name: 'horario_aceite_range', label: 'Janela do aceite', type: 'timeRange', nameDe: 'horario_aceite_inicio', nameAte: 'horario_aceite_fim', labelDe: 'De', labelAte: 'Até', span: true },
  { name: 'dia_aceite_range', label: 'Dias para aceite', type: 'dayRange', nameDe: 'dia_aceite_inicio', nameAte: 'dia_aceite_fim', labelDe: 'De', labelAte: 'Até', span: true },
  { name: 'protocolo', label: 'Protocolo' },
  { name: 'login', label: 'Login (portal do cliente)' },
  { name: 'senha', label: 'Senha (portal do cliente)' },
  { name: 'responsaveis_recebimento', type: 'responsaveis', span: true },
  { name: 'observacoes', label: 'Observações', type: 'longText', span: true, maxRows: 6 },
];

const STATUS_FUNIL_FILTROS = [
  { id: 'aprovacao', label: 'Aprovação' },
  { id: 'ativacao', label: 'Ativação' },
  { id: 'envio', label: 'Envio' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'confirmacao', label: 'Confirmação' },
  { id: 'concluido', label: 'Concluído' },
  { id: 'retorno', label: 'Retorno' }
];

function normalizarStatusFunilFiltros(etapas = []) {
  const normalizados = etapas
    .map(etapa => ({
      id: etapa.codigo || etapa.id,
      label: etapa.nome || etapa.name
    }))
    .filter(etapa => etapa.id && etapa.label);

  return [
    ...(normalizados.length > 0 ? normalizados : STATUS_FUNIL_FILTROS.filter(status => status.id !== 'retorno')),
    { id: 'retorno', label: 'Retorno' }
  ];
}

function toInputDate(value) {
  if (!value) return '';

  const texto = value instanceof Date
    ? [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0')
      ].join('-')
    : String(value).slice(0, 10);

  return isDataVendaValida(texto) ? texto : '';
}

function normalizarDataVendaInput(value) {
  if (!value) return '';

  const texto = String(value).trim();
  const iso = toInputDate(texto);

  if (iso) return iso;

  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

  if (!match) return '';

  const [, dia, mes, ano] = match;
  const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
  const data = `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

  return isDataVendaValida(data) ? data : '';
}

function gerarProtocoloDataHora(data = new Date()) {
  const pad = value => String(value).padStart(2, '0');

  return [
    data.getFullYear(),
    pad(data.getMonth() + 1),
    pad(data.getDate()),
    pad(data.getHours()),
    pad(data.getMinutes()),
    pad(data.getSeconds())
  ].join('');
}

function formatarData(value) {
  if (!value) return '-';

  const date = toInputDate(value);
  if (!date) return '-';

  const [ano, mes, dia] = date.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : value;
}

function isDataVendaValida(value) {
  if (!value) return false;

  const texto = String(value).slice(0, 10);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return false;

  const [, ano, mes, dia] = match;
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00`);

  return Number(ano) >= 1900
    && data.getFullYear() === Number(ano)
    && data.getMonth() + 1 === Number(mes)
    && data.getDate() === Number(dia);
}

function formatarMoeda(value) {
  if (value === null || value === undefined || value === '') return '-';

  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function parseValorInput(valor) {
  if (valor === undefined || valor === null || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

  return Number(String(valor).replace(/\./g, '').replace(',', '.')) || 0;
}

function formatarInputMoedaBR(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');

  if (!digitos) return '';

  const numero = Number(digitos) / 100;

  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function apenasDigitos(valor, limite) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return limite ? digitos.slice(0, limite) : digitos;
}

function formatarTelefoneComDdd(valor, celular = true) {
  const limite = celular ? 11 : 10;
  const digitos = apenasDigitos(valor, limite);

  if (digitos.length <= 2) {
    return digitos ? `(${digitos}` : '';
  }

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);

  if (celular) {
    if (numero.length <= 5) return `(${ddd}) ${numero}`;
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }

  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

function formatarCpf(valor) {
  const digitos = apenasDigitos(valor, 11);

  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function formatarCnpj(valor) {
  const digitos = apenasDigitos(valor, 14);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function formatarCep(valor) {
  const digitos = apenasDigitos(valor, 8);

  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

function formatarDiaVencimento(valor) {
  const digitos = apenasDigitos(valor, 2);
  if (!digitos) return '';

  const dia = Math.min(Number(digitos), 31);
  return dia > 0 ? String(dia) : '';
}

function formatarCampoVenda(campo, valor) {
  if (campo === 'telefone' || campo === 'telefone_representante_legal' || campo === 'telefone_administrador') return formatarTelefoneComDdd(valor, true);
  if (campo === 'fixo_ddd') return formatarTelefoneComDdd(valor, false);
  if (campo === 'cpf_representante_legal' || campo === 'cpf_administrador') return formatarCpf(valor);
  if (campo === 'cnpj') return formatarCnpj(valor);
  if (campo === 'cep') return formatarCep(valor);
  if (campo === 'uf') return String(valor || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
  if (campo === 'ddd') return apenasDigitos(valor, 2);
  if (campo === 'gb') return apenasDigitos(valor, 4);
  if (campo === 'quantidade_linhas') return apenasDigitos(valor, 4);
  if (campo === 'dia_vencimento') return formatarDiaVencimento(valor);
  return valor;
}

function getInputModeCampo(campo) {
  if ([
    'telefone', 'fixo_ddd', 'telefone_representante_legal', 'telefone_administrador',
    'cpf_representante_legal', 'cpf_administrador', 'cnpj', 'cep', 'ddd', 'gb', 'quantidade_linhas', 'dia_vencimento'
  ].includes(campo)) {
    return 'numeric';
  }

  return undefined;
}

function getMaxLengthCampo(campo, maxLength) {
  const limites = {
    telefone: 15,
    fixo_ddd: 14,
    telefone_representante_legal: 15,
    telefone_administrador: 15,
    cpf_representante_legal: 14,
    cpf_administrador: 14,
    cnpj: 18,
    cep: 9,
    ddd: 2,
    gb: 4,
    uf: 2,
    dia_vencimento: 2,
    quantidade_linhas: 4
  };

  return limites[campo] || maxLength;
}

function calcularTotalItensChips(itens = []) {
  return itens.reduce((acc, item) => (
    acc + (Number(item.quantidade || 0) * parseValorInput(item.valor_unitario))
  ), 0);
}

function resumirGigasItensChips(itens = []) {
  const valores = itens
    .map(item => String(item.gb || '').trim())
    .filter(Boolean);

  return Array.from(new Set(valores)).join(', ');
}

function normalizarTipoLinhaChip(valor, fallback = 'novo') {
  const texto = normalizarTextoBusca(valor);
  if (texto.includes('porta')) return 'portabilidade';
  if (texto.includes('novo')) return 'novo';
  return fallback;
}

function somarQuantidadeItensChips(itens = []) {
  return itens.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
}

function somarQuantidadePortabilidadeItensChips(itens = []) {
  return itens.reduce((acc, item) => (
    normalizarTipoLinhaChip(item.tipo_linha) === 'portabilidade'
      ? acc + Number(item.quantidade || 0)
      : acc
  ), 0);
}

function temChipPortabilidade(itens = []) {
  return somarQuantidadePortabilidadeItensChips(itens) > 0;
}

function parseItensChips(valor, gbPadrao = '', tipoLinhaPadrao = 'novo') {
  if (!valor) return [{ ...ITEM_CHIP_VAZIO }];

  if (Array.isArray(valor)) {
    const itens = valor.map(item => ({
      quantidade: item.quantidade ? String(item.quantidade) : '',
      gb: formatarCampoVenda('gb', item.gb || gbPadrao || ''),
      valor_unitario: item.valor_unitario ? String(item.valor_unitario).replace('.', ',') : '',
      tipo_linha: normalizarTipoLinhaChip(item.tipo_linha || item.tipo || item.categoria, tipoLinhaPadrao),
      vendedora_id: item.vendedora_id ? String(item.vendedora_id) : ''
    }));

    return itens.length > 0 ? itens : [{ ...ITEM_CHIP_VAZIO }];
  }

  if (typeof valor === 'string') {
    try {
      return parseItensChips(JSON.parse(valor), gbPadrao, tipoLinhaPadrao);
    } catch {
      const itens = valor
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean)
        .map(linha => {
          const match = linha.match(/^(\d+)\s*x\s*([\d.,]+)$/i);

          if (!match) return null;

          return {
            quantidade: match[1],
            gb: formatarCampoVenda('gb', gbPadrao || ''),
            valor_unitario: match[2],
            tipo_linha: tipoLinhaPadrao
          };
        })
        .filter(Boolean);

      return itens.length > 0 ? itens : [{ ...ITEM_CHIP_VAZIO }];
    }
  }

  return [{ ...ITEM_CHIP_VAZIO }];
}

function normalizarTextoBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isTipoPortabilidade(tipoVenda) {
  return normalizarTextoBusca(tipoVenda?.nome).includes('portabilidade');
}

function parseNumerosPortados(valor) {
  if (!valor) return [NUMERO_PORTADO_VAZIO];

  if (Array.isArray(valor)) {
    const numeros = valor
      .map(item => String(item || '').trim())
      .filter(Boolean);

    return numeros.length > 0 ? numeros : [NUMERO_PORTADO_VAZIO];
  }

  if (typeof valor === 'string') {
    try {
      return parseNumerosPortados(JSON.parse(valor));
    } catch {
      const numeros = valor
        .split(/\r?\n|[,;]/)
        .map(item => item.trim())
        .filter(Boolean);

      return numeros.length > 0 ? numeros : [NUMERO_PORTADO_VAZIO];
    }
  }

  return [NUMERO_PORTADO_VAZIO];
}

function montarNumerosPortados(valor) {
  return (Array.isArray(valor) ? valor : parseNumerosPortados(valor))
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizarVenda(venda) {
  // Montar array de vendedoras a partir da relação (junction) ou do campo legado
  const vendedorasIds = Array.isArray(venda.vendedoras) && venda.vendedoras.length > 0
    ? venda.vendedoras.map(v => String(v.id || v))
    : venda.vendedora_id ? [String(venda.vendedora_id)] : [];
  const tipoLinhaPadrao = isTipoPortabilidade(venda.tipoVenda) ? 'portabilidade' : 'novo';

  return {
    ...VENDA_VAZIA,
    ...venda,
    data_venda: toInputDate(venda.data_venda),
    data_ativacao: toInputDate(venda.data_ativacao),
    valor_total: venda.valor_total ?? '',
    valores_unitarios_chips: parseItensChips(venda.valores_unitarios_chips, venda.gb, tipoLinhaPadrao),
    numeros_portados: parseNumerosPortados(venda.numeros_portados),
    quantidade_linhas: venda.quantidade_linhas ?? '',
    dia_vencimento: venda.dia_vencimento ?? '',
    operadora_id: venda.operadora_id ? String(venda.operadora_id) : '',
    tipo_venda_id: venda.tipo_venda_id ? String(venda.tipo_venda_id) : '',
    servico_id: venda.servico_id ? String(venda.servico_id) : '',
    vendedora_id: venda.vendedora_id ? String(venda.vendedora_id) : '',
    vendedoras: vendedorasIds,
    cliente_id: venda.cliente_id ? String(venda.cliente_id) : ''
  };
}

function ItensChipsInput({ value, onChange, vendedoras = [], limiteQuantidade = 0 }) {
  const itens = Array.isArray(value) && value.length > 0 ? value : [{ ...ITEM_CHIP_VAZIO }];
  const total = calcularTotalItensChips(itens);
  const mostrarVendedora = vendedoras.length > 1;
  const limite = Number(limiteQuantidade || 0);
  const quantidadeTotal = somarQuantidadeItensChips(itens);
  const limiteAtingido = limite > 0 && quantidadeTotal >= limite;

  function atualizarItem(index, campo, novoValor) {
    let valor = novoValor;

    if (campo === 'quantidade') {
      const outros = itens.reduce((acc, item, itemIndex) => (
        itemIndex === index ? acc : acc + Number(item.quantidade || 0)
      ), 0);
      const maximo = limite > 0 ? Math.max(limite - outros, 0) : 9999;
      const quantidade = Math.min(Number(apenasDigitos(valor, 4) || 0), maximo);
      valor = quantidade > 0 ? String(quantidade) : '';
    }

    onChange(itens.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return { ...item, [campo]: valor };
    }));
  }

  function adicionarItem() {
    if (limiteAtingido) return;
    onChange([...itens, { ...ITEM_CHIP_VAZIO }]);
  }

  function removerItem(index) {
    const proximos = itens.filter((_, itemIndex) => itemIndex !== index);
    onChange(proximos.length > 0 ? proximos : [{ ...ITEM_CHIP_VAZIO }]);
  }

  return (
    <div className={`chip-items${mostrarVendedora ? ' chip-items--com-vendedora' : ''}`}>
      <div className="chip-items__head">
        <span>Qtd.</span>
        <span>GB</span>
        <span>Tipo</span>
        <span>Valor unit.</span>
        <span>Subtotal</span>
        {mostrarVendedora && <span>Vendedora</span>}
        <span></span>
      </div>

      {itens.map((item, index) => {
        const subtotal = Number(item.quantidade || 0) * parseValorInput(item.valor_unitario);

        return (
          <div key={index} className="chip-item-row">
            <input
              type="number"
              min="1"
              max={limite || undefined}
              value={item.quantidade}
              onChange={e => atualizarItem(index, 'quantidade', e.target.value)}
              placeholder="3"
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={getMaxLengthCampo('gb')}
              value={item.gb}
              onChange={e => atualizarItem(index, 'gb', formatarCampoVenda('gb', e.target.value))}
              placeholder="20"
            />
            <select
              value={item.tipo_linha || 'novo'}
              onChange={e => atualizarItem(index, 'tipo_linha', e.target.value)}
            >
              {TIPOS_LINHA_CHIP.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={item.valor_unitario}
              onChange={e => atualizarItem(index, 'valor_unitario', formatarInputMoedaBR(e.target.value))}
              placeholder="29,99"
            />
            <div className="chip-item-subtotal">{formatarMoeda(subtotal)}</div>
            {mostrarVendedora && (
              <select
                value={item.vendedora_id || ''}
                onChange={e => atualizarItem(index, 'vendedora_id', e.target.value)}
              >
                <option value="">—</option>
                {vendedoras.map(v => (
                  <option key={v.id} value={String(v.id)}>{v.nome}</option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => removerItem(index)} title="Remover item">
              <I.Trash size={13} />
            </button>
          </div>
        );
      })}

      <div className="chip-items__footer">
        <button type="button" className="btn btn-sm" onClick={adicionarItem} disabled={limiteAtingido}>
          <I.Plus size={13} /> Adicionar chip
        </button>
        <div className="chip-items__summary">
          {limite > 0 && <span>{quantidadeTotal}/{limite} chips</span>}
          <strong>{formatarMoeda(total)}</strong>
        </div>
      </div>
    </div>
  );
}

function VendedorasSelect({ value = [], options = [], onChange }) {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const wrapperRef = useRef(null);

  const selecionadas = options.filter(v => value.includes(String(v.id)));
  const disponiveis = options.filter(v => !value.includes(String(v.id)));

  useEffect(() => {
    function handleClickFora(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  function adicionar(vendedora) {
    onChange([...value, String(vendedora.id)]);
    setDropdownAberto(false);
  }

  function remover(id) {
    onChange(value.filter(v => v !== String(id)));
  }

  return (
    <div className="vendedoras-select" ref={wrapperRef}>
      <div className="vendedoras-chips">
        {selecionadas.map(v => (
          <span key={v.id} className="vendedoras-chip">
            {v.nome}
            <button type="button" onClick={() => remover(v.id)} title="Remover">
              <I.Close size={11} />
            </button>
          </span>
        ))}
        {disponiveis.length > 0 && (
          <button
            type="button"
            className="btn btn-sm vendedoras-add-btn"
            onClick={() => setDropdownAberto(prev => !prev)}
          >
            <I.Plus size={13} /> Adicionar vendedora
          </button>
        )}
      </div>
      {dropdownAberto && disponiveis.length > 0 && (
        <div className="vendedoras-dropdown">
          {disponiveis.map(v => (
            <button key={v.id} type="button" className="vendedoras-dropdown__item" onClick={() => adicionar(v)}>
              {v.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ajustarQuantidadeNumerosPortados(value, quantidade) {
  const total = Math.max(Number(quantidade || 0), 0);
  if (total === 0) return [NUMERO_PORTADO_VAZIO];

  const atuais = Array.isArray(value) ? value : parseNumerosPortados(value);
  const preenchidos = atuais.length > 0 ? atuais : [NUMERO_PORTADO_VAZIO];

  return Array.from({ length: total }, (_, index) => preenchidos[index] || NUMERO_PORTADO_VAZIO);
}

function NumerosPortadosInput({ value, onChange, quantidadeEsperada = 0 }) {
  const numeros = Array.isArray(value) && value.length > 0 ? value : [NUMERO_PORTADO_VAZIO];
  const limite = Math.max(Number(quantidadeEsperada || 0), 0);
  const limiteAtingido = limite > 0 && numeros.length >= limite;

  function atualizarNumero(index, novoValor) {
    onChange(numeros.map((numero, numeroIndex) => (
      numeroIndex === index ? novoValor : numero
    )));
  }

  function adicionarNumero() {
    if (limiteAtingido) return;
    onChange([...numeros, NUMERO_PORTADO_VAZIO]);
  }

  function removerNumero(index) {
    const proximos = numeros.filter((_, numeroIndex) => numeroIndex !== index);
    onChange(proximos.length > 0 ? proximos : [NUMERO_PORTADO_VAZIO]);
  }

  return (
    <div className="ported-numbers">
      {numeros.map((numero, index) => (
        <div key={index} className="ported-number-row">
          <input
            type="text"
            inputMode="numeric"
            value={numero}
            onChange={event => atualizarNumero(index, formatarTelefoneComDdd(event.target.value, true))}
            placeholder="(11) 99999-9999"
            maxLength={15}
          />
          <button type="button" className="btn btn-icon btn-ghost" onClick={() => removerNumero(index)} title="Remover numero">
            <I.Trash size={13} />
          </button>
        </div>
      ))}

      <div className="ported-numbers__footer">
        <button type="button" className="btn btn-sm" onClick={adicionarNumero} disabled={limiteAtingido}>
          <I.Plus size={13} /> Adicionar numero
        </button>
        {limite > 0 && <span>{numeros.length}/{limite} números</span>}
      </div>
    </div>
  );
}

function ResponsaveisRecebimentoInput({ form, onChange }) {
  const slots = [
    { nomeKey: 'responsavel_recebimento', rgKey: 'rg_responsavel_recebimento' },
    { nomeKey: 'responsavel_recebimento_2', rgKey: 'rg_responsavel_recebimento_2' },
    { nomeKey: 'responsavel_recebimento_3', rgKey: 'rg_responsavel_recebimento_3' },
  ];
  const preenchidos = slots.reduce((total, slot, index) => (
    form[slot.nomeKey] || form[slot.rgKey] ? index + 1 : total
  ), 1);
  const [linhasVisiveis, setLinhasVisiveis] = useState(Math.max(1, preenchidos));
  const visiveis = slots.slice(0, linhasVisiveis);

  function removerLinha(index) {
    const slot = slots[index];
    onChange(slot.nomeKey, '');
    onChange(slot.rgKey, '');
    setLinhasVisiveis(prev => Math.max(1, prev - 1));
  }

  return (
    <div className="responsaveis-list">
      {visiveis.map((slot, index) => (
        <div key={slot.nomeKey} className="responsavel-row">
          <span className="responsavel-row__num">{index + 1}</span>
          <div className="responsavel-row__campos">
            <input
              type="text"
              placeholder="Nome do responsável"
              value={form[slot.nomeKey] || ''}
              onChange={event => onChange(slot.nomeKey, event.target.value)}
            />
            <input
              type="text"
              placeholder="RG"
              value={form[slot.rgKey] || ''}
              onChange={event => onChange(slot.rgKey, event.target.value)}
            />
          </div>
          {linhasVisiveis > 1 && (
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => removerLinha(index)} title="Remover responsável">
              <I.Trash size={13} />
            </button>
          )}
        </div>
      ))}

      {linhasVisiveis < slots.length && (
        <button type="button" className="btn btn-sm responsaveis-add-btn" onClick={() => setLinhasVisiveis(prev => Math.min(prev + 1, slots.length))}>
          <I.Plus size={13} /> Adicionar responsável
        </button>
      )}
    </div>
  );
}

function ClienteVendaSelect({ value, clientes, onChange, onCreateClient }) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const clienteSelecionado = clientes.find(cliente => String(cliente.id) === String(value));
  const textoClienteSelecionado = clienteSelecionado?.nome || clienteSelecionado?.razao_social || '';
  const textoBusca = busca || textoClienteSelecionado;
  const buscaNormalizada = textoBusca.trim().toLowerCase();
  const clientesFiltrados = clientes.filter(cliente => {
    if (!buscaNormalizada) return true;

    return [
      cliente.nome,
      cliente.razao_social,
      cliente.cnpj,
      cliente.email,
      cliente.responsavel_nome
    ].filter(Boolean).some(valor => String(valor).toLowerCase().includes(buscaNormalizada));
  }).slice(0, 8);

  useEffect(() => {
    function handleClickFora(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setAberto(false);
      }
    }

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  function selecionarCliente(cliente) {
    onChange(String(cliente.id));
    setBusca('');
    setAberto(false);
  }

  function limparCliente() {
    onChange('');
    setBusca('');
    setAberto(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAberto(true);
      setIndiceAtivo(prev => Math.min(prev + 1, Math.max(clientesFiltrados.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAberto(true);
      setIndiceAtivo(prev => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter' && aberto && clientesFiltrados[indiceAtivo]) {
      event.preventDefault();
      selecionarCliente(clientesFiltrados[indiceAtivo]);
      return;
    }

    if (event.key === 'Escape') {
      setAberto(false);
    }
  }

  const mostrarLista = aberto && clientes.length > 0;
  const activeDescendant = mostrarLista && clientesFiltrados[indiceAtivo]
    ? `cliente-option-${clientesFiltrados[indiceAtivo].id}`
    : undefined;

  return (
    <div className="venda-cliente-select" ref={wrapperRef}>
      <div className={`venda-cliente-combobox ${mostrarLista ? 'is-open' : ''}`}>
        <I.Search size={14} />
        <input
          ref={inputRef}
          value={textoBusca}
          onChange={event => {
            setBusca(event.target.value);
            setIndiceAtivo(0);
            setAberto(true);

            if (value) {
              onChange('');
            }
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar cliente por nome, razão social, CNPJ ou e-mail"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls="cliente-options"
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="venda-cliente-combobox__toggle"
          onClick={() => setAberto(prev => !prev)}
          title={aberto ? 'Fechar resultados' : 'Abrir resultados'}
        >
          <I.ChevronDown size={14} />
        </button>

        {mostrarLista && (
          <div className="venda-cliente-options" id="cliente-options" role="listbox">
            {clientesFiltrados.length > 0 ? (
              clientesFiltrados.map((cliente, index) => {
                const selecionado = String(cliente.id) === String(value);
                const ativo = index === indiceAtivo;

                return (
                  <button
                    key={cliente.id}
                    id={`cliente-option-${cliente.id}`}
                    type="button"
                    className={`venda-cliente-option ${ativo ? 'is-active' : ''} ${selecionado ? 'is-selected' : ''}`}
                    onMouseEnter={() => setIndiceAtivo(index)}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => selecionarCliente(cliente)}
                    role="option"
                    aria-selected={selecionado}
                  >
                    <span className="venda-cliente-option__main">
                      <strong>{cliente.nome || 'Cliente sem nome'}</strong>
                      <span>{cliente.razao_social || 'Sem razão social'} - {cliente.cnpj || 'Sem CNPJ'}</span>
                    </span>
                    <span className="venda-cliente-option__meta">
                      <span>{cliente.email || cliente.responsavel_nome || 'Sem contato principal'}</span>
                      <span>{cliente.operadoraAtual?.nome || 'Sem operadora'} - {cliente.quantidade_chips ?? 0} chips</span>
                    </span>
                    {selecionado && <I.Check size={14} />}
                  </button>
                );
              })
            ) : (
              <div className="venda-cliente-no-results">
                <span>Nenhum cliente encontrado.</span>
                <button type="button" className="btn btn-sm" onMouseDown={event => event.preventDefault()} onClick={onCreateClient}>
                  <I.Plus size={13} /> Cadastrar cliente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {clientes.length === 0 && (
        <div className="venda-cliente-empty">
          <span>Nenhum cliente disponível. Cadastre um cliente ou solicite permissão para visualizar clientes.</span>
          <button type="button" className="btn btn-sm" onClick={onCreateClient}>
            <I.Plus size={13} /> Cadastrar cliente
          </button>
        </div>
      )}

      {clienteSelecionado && (
        <div className="venda-cliente-card">
          <div>
            <strong>{clienteSelecionado.nome}</strong>
            <span>{clienteSelecionado.razao_social || 'Sem razão social'} - {clienteSelecionado.cnpj || 'Sem CNPJ'}</span>
          </div>
          <div>
            <span>{clienteSelecionado.email || 'Sem e-mail'}</span>
            <span>{clienteSelecionado.operadoraAtual?.nome || 'Sem operadora'} - {clienteSelecionado.quantidade_chips ?? 0} chips</span>
          </div>
          <button type="button" className="btn btn-icon btn-ghost" onClick={limparCliente} title="Trocar cliente">
            <I.Close size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function VendaModal({ venda, initialValues, clientes, vendedoras, operadoras, tiposVenda, servicos, onClose, onSave, onCreateClient }) {
  const [form, setForm] = useState(venda ? normalizarVenda(venda) : { ...VENDA_VAZIA, ...(initialValues || {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [cepStatus, setCepStatus] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [abaAtiva, setAbaAtiva] = useState('venda');
  const ultimoCnpjConsultadoRef = useRef(venda ? sanitizarCnpj(form.cnpj) : '');
  const cepPreenchidoPorCnpjRef = useRef('');
  const vendaPortabilidade = temChipPortabilidade(form.valores_unitarios_chips);
  const quantidadePortabilidade = somarQuantidadePortabilidadeItensChips(form.valores_unitarios_chips || []);
  const quantidadeLinhasFechadas = Number(form.quantidade_linhas || 0);
  function atualizarCampo(campo, valor) {
    setForm(prev => ({
      ...prev,
      [campo]: formatarCampoVenda(campo, valor)
    }));
  }

  function formatarMensagemCnpj(dados) {
    const totalFontes = dados.fontesComSucesso?.length || (dados.fonte ? 1 : 0);
    const origem = totalFontes > 1 ? `${totalFontes} fontes` : (dados.fonte || 'fonte publica');
    const cache = dados.cache ? ' Dados recentes do cache.' : '';

    return `Dados combinados de ${origem}. Confira antes de salvar.${cache}`;
  }

  function atualizarClienteVenda(valor) {
    const c = clientes.find(cliente => String(cliente.id) === String(valor));

    setForm(prev => {
      const telefoneWhatsapp = c ? formatarTelefoneComDdd([c.whatsapp_ddd, c.whatsapp_numero].filter(Boolean).join(''), true) : '';
      const telefoneFixo = c ? formatarTelefoneComDdd([c.fixo_ddd, c.fixo_numero].filter(Boolean).join(''), false) : '';
      const nomeRl = c?.responsavel_tipo === 'rl' ? (c.responsavel_nome || '') : '';
      const nomeAdm = c?.responsavel_tipo === 'adm' ? (c.responsavel_nome || '') : '';

      return {
        ...prev,
        cliente_id: valor,
        nome: prev.nome || c?.nome || '',
        razao_social: prev.razao_social || c?.razao_social || '',
        cnpj: prev.cnpj || formatarCnpj(c?.cnpj || ''),
        email: prev.email || c?.email || '',
        telefone: prev.telefone || telefoneWhatsapp || '',
        fixo_ddd: prev.fixo_ddd || telefoneFixo || '',
        nome_representante_legal: prev.nome_representante_legal || nomeRl,
        nome_administrador: prev.nome_administrador || nomeAdm,
      };
    });
  }

  function aplicarDadosCnpj(dados, sobrescrever = false) {
    setForm(prev => {
      const cepFormatado = formatarCep(dados.cep);
      if (cepFormatado) {
        cepPreenchidoPorCnpjRef.current = apenasDigitos(cepFormatado, 8);
      }

      return {
        ...prev,
        nome: sobrescrever
          ? (dados.nomeFantasia || dados.razaoSocial || prev.nome || '')
          : (prev.nome || dados.nomeFantasia || dados.razaoSocial || ''),
        razao_social: sobrescrever ? (dados.razaoSocial || prev.razao_social || '') : (prev.razao_social || dados.razaoSocial || ''),
        email: sobrescrever ? (dados.email || prev.email || '') : (prev.email || dados.email || ''),
        telefone: sobrescrever
          ? (formatarTelefoneComDdd(dados.telefone, true) || prev.telefone || '')
          : (prev.telefone || formatarTelefoneComDdd(dados.telefone, true)),
        cep: sobrescrever ? (cepFormatado || prev.cep || '') : (prev.cep || cepFormatado),
        endereco: sobrescrever ? (dados.endereco || prev.endereco || '') : (prev.endereco || dados.endereco || ''),
        numero_endereco: sobrescrever ? (dados.numero || prev.numero_endereco || '') : (prev.numero_endereco || dados.numero || ''),
        complemento: sobrescrever ? (dados.complemento || prev.complemento || '') : (prev.complemento || dados.complemento || ''),
        bairro: sobrescrever ? (dados.bairro || prev.bairro || '') : (prev.bairro || dados.bairro || ''),
        municipio: sobrescrever ? (dados.municipio || prev.municipio || '') : (prev.municipio || dados.municipio || ''),
        uf: sobrescrever ? (formatarCampoVenda('uf', dados.uf) || prev.uf || '') : (prev.uf || formatarCampoVenda('uf', dados.uf))
      };
    });
  }

  async function buscarDadosCnpj(manual = false) {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length !== 14) {
      if (manual) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'Informe um CNPJ com 14 dígitos.' });
      }
      return;
    }

    if (isCnpjRepetido(cnpj)) {
      setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
      return;
    }

    if (!manual && ultimoCnpjConsultadoRef.current === cnpj) {
      return;
    }

    ultimoCnpjConsultadoRef.current = cnpj;
    setConsultandoCnpj(true);
    setCnpjStatus({ tipo: 'info', mensagem: 'Buscando CNPJ...' });

    try {
      const dados = await consultarCnpj(cnpj);
      aplicarDadosCnpj(dados, manual);
      setCnpjStatus({
        tipo: 'sucesso',
        mensagem: formatarMensagemCnpj(dados)
      });
    } catch (error) {
      setCnpjStatus({ tipo: 'erro', mensagem: error.message || 'Não foi possível consultar o CNPJ.' });
    } finally {
      setConsultandoCnpj(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length === 0) {
      setCnpjStatus({ tipo: '', mensagem: '' });
      return;
    }

    if (cnpj.length === 14) {
      if (isCnpjRepetido(cnpj)) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
        return;
      }

      buscarDadosCnpj(false);
    }
  }, [form.cnpj]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const cep = apenasDigitos(form.cep, 8);

    if (cep.length !== 8) {
      setCepStatus('');
      return;
    }

    if (
      cepPreenchidoPorCnpjRef.current === cep
      && (form.endereco || form.bairro || form.municipio || form.uf)
    ) {
      setCepStatus('Endereço preenchido pelo CNPJ.');
      return;
    }

    let cancelado = false;
    setCepStatus('Buscando CEP...');

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(response => {
        if (!response.ok) throw new Error('Erro ao buscar CEP.');
        return response.json();
      })
      .then(data => {
        if (cancelado) return;

        if (data.erro) {
          setCepStatus('CEP não encontrado.');
          return;
        }

        setForm(prev => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          municipio: data.localidade || prev.municipio,
          uf: data.uf || prev.uf,
          complemento: prev.complemento || data.complemento || ''
        }));
        setCepStatus('Endereço preenchido pelo CEP.');
      })
      .catch(() => {
        if (!cancelado) {
          setCepStatus('Não foi possível buscar o CEP.');
        }
      });

    return () => {
      cancelado = true;
    };
  }, [form.cep]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!vendaPortabilidade) return;

    setForm(prev => ({
      ...prev,
      numeros_portados: ajustarQuantidadeNumerosPortados(prev.numeros_portados, quantidadePortabilidade)
    }));
  }, [vendaPortabilidade, quantidadePortabilidade]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      if (!form.cliente_id) {
        setErro('Selecione um cliente para cadastrar a venda.');
        setSalvando(false);
        return;
      }

      const numerosPortados = montarNumerosPortados(form.numeros_portados);
      const quantidadeChips = somarQuantidadeItensChips(form.valores_unitarios_chips || []);

      if (quantidadeLinhasFechadas > 0 && quantidadeChips > quantidadeLinhasFechadas) {
        setErro('A quantidade de chips não pode ser maior que a quantidade de linhas fechadas.');
        setSalvando(false);
        return;
      }

      if (vendaPortabilidade && !numerosPortados) {
        setErro('Informe pelo menos um numero a ser portado.');
        setSalvando(false);
        return;
      }

      const chipsProcessados = (form.valores_unitarios_chips || [])
        .map(item => ({
          quantidade: Number(item.quantidade || 0),
          gb: String(item.gb || '').trim(),
          tipo_linha: normalizarTipoLinhaChip(item.tipo_linha),
          valor_unitario: parseValorInput(item.valor_unitario),
          ...(item.vendedora_id ? { vendedora_id: Number(item.vendedora_id) } : {})
        }))
        .filter(item => item.quantidade > 0 && item.valor_unitario > 0);

      const payload = {
        ...form,
        data_venda: normalizarDataVendaInput(form.data_venda) || null,
        data_ativacao: normalizarDataVendaInput(form.data_ativacao) || null,
        numeros_portados: vendaPortabilidade ? numerosPortados : null,
        valores_unitarios_chips: chipsProcessados,
        vendedoras: (form.vendedoras || []).map(Number).filter(Boolean)
      };

      payload.valor_total = calcularTotalItensChips(form.valores_unitarios_chips);
      payload.gb = resumirGigasItensChips(payload.valores_unitarios_chips);

      await onSave(payload);
    } catch (error) {
      setErro(error.message || 'Erro ao salvar venda.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{venda ? 'Editar venda' : 'Nova venda'}</div>
              <div className="modal-sub">Selecione o cliente e preencha apenas os dados especificos da venda.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" title="Fechar" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${abaAtiva === 'venda' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('venda')}
          >
            <I.Chart size={14} /> Venda
          </button>
          <button
            type="button"
            className={`modal-tab ${abaAtiva === 'notas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('notas')}
          >
            <I.Note size={14} /> Notas
          </button>
        </div>

        <div className="modal-body">
          {abaAtiva === 'notas' ? (
            <NotasEntidadeTab tipo="venda" entidadeId={venda?.id} />
          ) : (
          <>
            <div className="vendas-form-grid">
            {CAMPOS.map(campo => {
              if (campo.section) {
                return <div key={campo.section} className="vendas-form-section">{campo.section}</div>;
              }

              if (campo.name === 'numeros_portados' && !vendaPortabilidade) {
                return null;
              }

              const labelCampo = campo.type === 'responsaveis'
                ? 'Responsáveis pelo recebimento'
                : campo.label;

              return (
                <div key={campo.name} className={`form-field ${campo.span ? 'span-2' : ''}`}>
                  {labelCampo && <label>{labelCampo}</label>}
                  {campo.type === 'client' ? (
                    <ClienteVendaSelect
                      value={form[campo.name] ?? ''}
                      clientes={clientes}
                      onChange={atualizarClienteVenda}
                      onCreateClient={onCreateClient}
                    />
                  ) : campo.type === 'cnpj' ? (
                    <>
                      <input
                        type="text"
                        maxLength={getMaxLengthCampo(campo.name, campo.maxLength)}
                        inputMode={getInputModeCampo(campo.name)}
                        value={form[campo.name] ?? ''}
                        onChange={e => atualizarCampo(campo.name, e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                      <div className="cnpj-lookup-row">
                        {cnpjStatus.mensagem && (
                          <span className={`field-hint cnpj-lookup-status ${cnpjStatus.tipo}`}>
                            {cnpjStatus.mensagem}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => buscarDadosCnpj(true)}
                          disabled={consultandoCnpj || sanitizarCnpj(form.cnpj).length !== 14}
                        >
                          {consultandoCnpj ? 'Buscando...' : cnpjStatus.tipo === 'erro' ? 'Tentar novamente' : 'Buscar dados'}
                        </button>
                      </div>
                    </>
                  ) : campo.type === 'sellers' ? (
                    <VendedorasSelect
                      value={form.vendedoras || []}
                      options={vendedoras}
                      onChange={ids => setForm(prev => ({ ...prev, vendedoras: ids }))}
                    />
                  ) : campo.type === 'timeRange' ? (
                    <div className="range-pair">
                      <div className="range-pair__item">
                        <label className="range-pair__label">{campo.labelDe}</label>
                        <input type="time" value={form[campo.nameDe] || ''} onChange={e => atualizarCampo(campo.nameDe, e.target.value)} />
                      </div>
                      <div className="range-pair__sep">até</div>
                      <div className="range-pair__item">
                        <label className="range-pair__label">{campo.labelAte}</label>
                        <input type="time" value={form[campo.nameAte] || ''} onChange={e => atualizarCampo(campo.nameAte, e.target.value)} />
                      </div>
                    </div>
                  ) : campo.type === 'dayRange' ? (
                    <div className="range-pair">
                      <div className="range-pair__item">
                        <label className="range-pair__label">{campo.labelDe}</label>
                        <select value={form[campo.nameDe] || ''} onChange={e => atualizarCampo(campo.nameDe, e.target.value)}>
                          <option value="">Selecione</option>
                          {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                      <div className="range-pair__sep">até</div>
                      <div className="range-pair__item">
                        <label className="range-pair__label">{campo.labelAte}</label>
                        <select value={form[campo.nameAte] || ''} onChange={e => atualizarCampo(campo.nameAte, e.target.value)}>
                          <option value="">Selecione</option>
                          {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : campo.type === 'responsaveis' ? (
                    <ResponsaveisRecebimentoInput form={form} onChange={atualizarCampo} />
                  ) : ['operator', 'saleType', 'service'].includes(campo.type) ? (
                    <select
                      value={form[campo.name] ?? ''}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      required={campo.required}
                    >
                      <option value="">Selecione</option>
                      {(
                        campo.type === 'operator'
                          ? operadoras
                          : campo.type === 'saleType'
                            ? tiposVenda
                            : servicos
                      ).map(item => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                  ) : campo.type === 'chips' ? (
                    <ItensChipsInput
                      value={form[campo.name]}
                      onChange={valor => atualizarCampo(campo.name, valor)}
                      vendedoras={vendedoras.filter(v => (form.vendedoras || []).includes(String(v.id)))}
                      limiteQuantidade={form.quantidade_linhas}
                    />
                  ) : campo.type === 'portedNumbers' ? (
                    <NumerosPortadosInput
                      value={form[campo.name]}
                      onChange={valor => atualizarCampo(campo.name, valor)}
                      quantidadeEsperada={quantidadePortabilidade}
                    />
                  ) : campo.name === 'protocolo' ? (
                    <div className="protocolo-input-row">
                      <input
                        type="text"
                        value={form[campo.name] ?? ''}
                        onChange={e => atualizarCampo(campo.name, e.target.value)}
                      />
                      <button type="button" className="btn btn-sm" onClick={() => atualizarCampo('protocolo', gerarProtocoloDataHora())}>
                        Gerar
                      </button>
                    </div>
                  ) : campo.type === 'longText' ? (
                    <AutoResizeTextarea
                      value={form[campo.name] ?? ''}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      maxRows={campo.maxRows || 5}
                    />
                  ) : (
                    <input
                      type={campo.type || 'text'}
                      step={campo.step}
                      min={campo.min}
                      max={campo.max}
                      maxLength={getMaxLengthCampo(campo.name, campo.maxLength)}
                      inputMode={getInputModeCampo(campo.name)}
                      value={form[campo.name] ?? ''}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                      required={campo.required}
                    />
                  )}
                  {campo.name === 'cep' && cepStatus && (
                    <span className="field-hint">{cepStatus}</span>
                  )}
                </div>
              );
            })}
          </div>

          {erro && <div className="alert-error" style={{ marginTop: 16 }}>{erro}</div>}
          </>
          )}
        </div>

        <div className="modal-footer">
          {abaAtiva === 'notas' ? (
            <button type="button" className="btn" onClick={onClose}>Fechar</button>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar venda'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function ConfirmarLixeiraModal({ venda, deletando, onClose, onConfirm }) {
  if (!venda) return null;

  return (
    <div className="modal-overlay" onClick={event => !deletando && event.target === event.currentTarget && onClose()}>
      <div className="modal trash-confirm-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Enviar venda para a lixeira?</div>
              <div className="modal-sub">{venda.cliente?.nome || venda.nome} - #{venda.id}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={deletando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="trash-warning">
            <I.AlertTriangle size={20} />
            <div>
              <strong>Esta venda será enviada para a lixeira.</strong>
              <span>Ela ficará disponível para restauração e será permanentemente deletada daqui a 1 mês.</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={deletando}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={deletando}>
            {deletando ? 'Enviando...' : 'Enviar para lixeira'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailTemplateModal({ dados, copiando, onClose, onCopy }) {
  if (!dados) return null;

  return (
    <div className="modal-overlay" onClick={event => !copiando && event.target === event.currentTarget && onClose()}>
      <div className="modal venda-email-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Corpo do email</div>
              <div className="modal-sub">{dados.operadora} - {dados.venda?.cliente?.nome || dados.venda?.nome || `Venda #${dados.venda?.id}`}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={copiando}>
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <textarea className="venda-email-preview" value={dados.texto || ''} readOnly />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={copiando}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={onCopy} disabled={copiando || !dados.texto}>
            {copiando ? 'Copiando...' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedoras, setVendedoras] = useState([]);
  const [operadoras, setOperadoras] = useState([]);
  const [tiposVenda, setTiposVenda] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [statusFunilFiltros, setStatusFunilFiltros] = useState(STATUS_FUNIL_FILTROS);
  const [busca, setBusca] = useState('');
  const [vendedoraId, setVendedoraId] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [tipoVendaId, setTipoVendaId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [statusFunil, setStatusFunil] = useState('');
  const [prioridadeFunil, setPrioridadeFunil] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const [uf, setUf] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [modalVenda, setModalVenda] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaInicial, setVendaInicial] = useState(null);
  const [vendaParaLixeira, setVendaParaLixeira] = useState(null);
  const [deletando, setDeletando] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState(null);
  const [gerandoEmailId, setGerandoEmailId] = useState(null);
  const [baixandoXlsxId, setBaixandoXlsxId] = useState(null);
  const [copiandoEmail, setCopiandoEmail] = useState(false);
  const usuarioLogado = getUsuarioLocal();
  const podeCriarVenda = temPermissao(usuarioLogado, 'vendas_criar');
  const podeEditarVenda = temPermissao(usuarioLogado, 'vendas_editar');
  const podeExcluirVenda = temPermissao(usuarioLogado, 'vendas_excluir');
  const podeListarClientes = temPermissao(usuarioLogado, ['clientes_ver_proprios', 'clientes_ver_todos']);
  const podeVerTodasVendas = temPermissao(usuarioLogado, 'vendas_ver_todas');
  const podeFunil = temPermissao(usuarioLogado, 'vendas');

  const filtros = useMemo(() => ({
    busca,
    vendedora_id: vendedoraId,
    operadora_id: operadoraId,
    tipo_venda_id: tipoVendaId,
    servico_id: servicoId,
    status_funil: statusFunil,
    prioridade_funil: prioridadeFunil,
    protocolo,
    uf,
    municipio,
    data_inicio: dataInicio,
    data_fim: dataFim,
    valor_min: valorMin,
    valor_max: valorMax
  }), [busca, vendedoraId, operadoraId, tipoVendaId, servicoId, statusFunil, prioridadeFunil, protocolo, uf, municipio, dataInicio, dataFim, valorMin, valorMax]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = [
    operadoraId,
    tipoVendaId,
    servicoId,
    protocolo,
    uf,
    municipio,
    dataInicio,
    dataFim,
    valorMin,
    valorMax,
    ...(podeVerTodasVendas ? [vendedoraId] : []),
    ...(podeFunil ? [statusFunil, prioridadeFunil] : [])
  ].filter(v => v !== '').length;

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  useEffect(() => {
    if (!erro) return undefined;
    const timer = setTimeout(() => setErro(''), 6000);
    return () => clearTimeout(timer);
  }, [erro]);

  async function carregarDados() {
    setErro('');
    setCarregando(true);

    try {
      const [vendasData, clientesData, vendedorasData, operadorasData, tiposVendaData, servicosData, etapasFunilData] = await Promise.all([
        listarVendas(filtros),
        podeListarClientes ? listarClientes() : Promise.resolve([]),
        listarVendedoras(),
        listarOperadoras(),
        listarTiposVenda(),
        listarServicos(),
        listarEtapasFunil()
      ]);

      setVendas(vendasData);
      setClientes(clientesData);
      setVendedoras(vendedorasData);
      setOperadoras(operadorasData);
      setTiposVenda(tiposVendaData);
      setServicos(servicosData);
      setStatusFunilFiltros(normalizarStatusFunilFiltros(etapasFunilData));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar vendas.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarDados();
  }, [filtros]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function abrirNovaVenda(initialValues = null) {
    setModalVenda(null);
    setVendaInicial(initialValues);
    setModalAberto(true);
  }

  useEffect(() => {
    function handleNovaVenda() {
      if (podeCriarVenda) {
        abrirNovaVenda();
      }
    }

    window.addEventListener('pos-venda:nova-venda', handleNovaVenda);
    return () => window.removeEventListener('pos-venda:nova-venda', handleNovaVenda);
  }, [podeCriarVenda]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (searchParams.get('nova') === '1' && podeCriarVenda) {
      abrirNovaVenda(location.state?.vendaPreenchida || null);
      navigate('/vendas', { replace: true, state: null });
    }
  }, [searchParams, podeCriarVenda, location.state, navigate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function abrirEdicao(venda) {
    setModalVenda(venda);
    setVendaInicial(null);
    setModalAberto(true);
  }

  async function salvarVenda(dados) {
    setErro('');
    const editando = Boolean(modalVenda);

    if (modalVenda) {
      await atualizarVenda(modalVenda.id, dados);
    } else {
      await criarVenda(dados);
    }

    setModalAberto(false);
    setModalVenda(null);
    setVendaInicial(null);
    await carregarDados();
    setSucesso(editando ? 'Venda atualizada com sucesso.' : 'Venda cadastrada com sucesso.');
  }

  async function confirmarRemocaoVenda() {
    if (!vendaParaLixeira) return;

    setDeletando(true);
    try {
      await deletarVenda(vendaParaLixeira.id);
      setVendas(prev => prev.filter(item => item.id !== vendaParaLixeira.id));
      setVendaParaLixeira(null);
      setSucesso('Venda enviada para a lixeira.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir venda.');
    } finally {
      setDeletando(false);
    }
  }

  async function handleBaixarXlsxClaro(venda) {
    setErro('');
    setBaixandoXlsxId(venda.id);
    try {
      const nome = venda.razao_social || venda.cliente?.razao_social || venda.cliente?.nome || venda.id;
      await baixarXlsxClaro(venda.id, nome);
    } catch (error) {
      setErro(error.message || 'Erro ao gerar planilha Claro.');
    } finally {
      setBaixandoXlsxId(null);
    }
  }

  async function abrirEmailVenda(venda) {
    setErro('');
    setSucesso('');
    setGerandoEmailId(venda.id);

    try {
      const resultado = await gerarEmailVenda(venda.id);
      setEmailTemplate({ ...resultado, venda });
    } catch (error) {
      setErro(error.message || 'Erro ao gerar corpo de email.');
    } finally {
      setGerandoEmailId(null);
    }
  }

  async function copiarEmailVenda() {
    if (!emailTemplate?.texto) return;

    setCopiandoEmail(true);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(emailTemplate.texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = emailTemplate.texto;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setSucesso('Corpo do email copiado.');
      setEmailTemplate(null);
    } catch {
      setErro('Não foi possível copiar o texto automaticamente.');
    } finally {
      setCopiandoEmail(false);
    }
  }

  function limparFiltros() {
    setBusca('');
    setVendedoraId('');
    setOperadoraId('');
    setTipoVendaId('');
    setServicoId('');
    setStatusFunil('');
    setPrioridadeFunil('');
    setProtocolo('');
    setUf('');
    setMunicipio('');
    setDataInicio('');
    setDataFim('');
    setValorMin('');
    setValorMax('');
  }

  return (
    <LayoutPrivado>
      {modalAberto && (
        <VendaModal
          venda={modalVenda}
          initialValues={vendaInicial}
          clientes={clientes}
          vendedoras={vendedoras}
          operadoras={operadoras}
          tiposVenda={tiposVenda}
          servicos={servicos}
          onClose={() => {
            setModalAberto(false);
            setVendaInicial(null);
          }}
          onSave={salvarVenda}
          onCreateClient={() => navigate('/clientes/novo')}
        />
      )}

      <ConfirmarLixeiraModal
        venda={vendaParaLixeira}
        deletando={deletando}
        onClose={() => setVendaParaLixeira(null)}
        onConfirm={confirmarRemocaoVenda}
      />

      <EmailTemplateModal
        dados={emailTemplate}
        copiando={copiandoEmail}
        onClose={() => setEmailTemplate(null)}
        onCopy={copiarEmailVenda}
      />

      {filtrosAbertos && (
        <div className="filtros-popup-overlay" onClick={() => setFiltrosAbertos(false)}>
          <div className="filtros-popup" onClick={e => e.stopPropagation()}>
            <div className="filtros-popup__header">
              <span>Filtros</span>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setFiltrosAbertos(false)}>
                <I.Close size={14} />
              </button>
            </div>
            <div className="filtros-popup__body">
              {podeVerTodasVendas && (
                <div className="filter-field">
                  <label>Vendedor(a)</label>
                  <select value={vendedoraId} onChange={e => setVendedoraId(e.target.value)}>
                    <option value="">Todas</option>
                    {vendedoras.map(vendedora => (
                      <option key={vendedora.id} value={vendedora.id}>{vendedora.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="filter-field">
                <label>Operadora</label>
                <select value={operadoraId} onChange={e => setOperadoraId(e.target.value)}>
                  <option value="">Todas</option>
                  {operadoras.map(operadora => (
                    <option key={operadora.id} value={operadora.id}>{operadora.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Tipo de venda</label>
                <select value={tipoVendaId} onChange={e => setTipoVendaId(e.target.value)}>
                  <option value="">Todos</option>
                  {tiposVenda.map(tipo => (
                    <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Produto</label>
                <select value={servicoId} onChange={e => setServicoId(e.target.value)}>
                  <option value="">Todos</option>
                  {servicos.map(servico => (
                    <option key={servico.id} value={servico.id}>{servico.nome}</option>
                  ))}
                </select>
              </div>
              {podeFunil && (
                <div className="filter-field">
                  <label>Status</label>
                  <select value={statusFunil} onChange={e => setStatusFunil(e.target.value)}>
                    <option value="">Todos</option>
                    {statusFunilFiltros.map(status => (
                      <option key={status.id} value={status.id}>{status.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {podeFunil && (
                <div className="filter-field">
                  <label>Prioridade</label>
                  <select value={prioridadeFunil} onChange={e => setPrioridadeFunil(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              )}
              <div className="filter-field">
                <label>Protocolo</label>
                <input value={protocolo} onChange={e => setProtocolo(e.target.value)} placeholder="Buscar por protocolo" />
              </div>
              <div className="filter-field">
                <label>UF</label>
                <select value={uf} onChange={e => setUf(e.target.value)}>
                  <option value="">Todos</option>
                  {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
              <div className="filter-field">
                <label>Município</label>
                <input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Buscar por município" />
              </div>
              <div className="filter-field">
                <label>Data inicial</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>Data final</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
              <div className="filter-field">
                <label>Valor min.</label>
                <input value={valorMin} onChange={e => setValorMin(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div className="filter-field">
                <label>Valor max.</label>
                <input value={valorMax} onChange={e => setValorMax(e.target.value)} placeholder="999,99" inputMode="decimal" />
              </div>
            </div>
            <div className="filtros-popup__footer">
              <button type="button" className="btn btn-ghost" onClick={limparFiltros} disabled={filtrosPopupAtivos === 0}>
                <I.Close size={13} /> Limpar filtros
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFiltrosAbertos(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="vendas-page">
        <div className="vendas-toolbar">
          <div className="search-box">
            <I.Search size={14} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone, tipo, produto, CNPJ ou cidade"
            />
          </div>

          <button className="btn" type="button" onClick={() => setFiltrosAbertos(true)}>
            <I.Filter size={14} /> Filtros
            {filtrosPopupAtivos > 0 && <span className="filtros-count">{filtrosPopupAtivos}</span>}
          </button>

          {podeExcluirVenda && (
            <button className="btn btn-danger" type="button" onClick={() => navigate('/vendas/lixeira')}>
              <I.Trash size={14} /> Lixeira
            </button>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          {vendas.length} vendas cadastradas
          {filtrosAtivos > 0 ? ` - ${filtrosAtivos} filtro(s) ativo(s)` : ''}
        </div>

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Operadora</th>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th>Linhas</th>
                  <th>GB</th>
                  <th>Valor</th>
                  <th>Venc.</th>
                  <th>Venda</th>
                  <th>Ativacao</th>
                  <th>Vendedor(a)</th>
                  <th className={`vendas-actions-col vendas-email-actions-col ${podeExcluirVenda ? 'has-delete' : ''}`}>Email</th>
                  {podeExcluirVenda && (
                    <th className="vendas-actions-col vendas-delete-actions-col">Excluir</th>
                  )}  
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeExcluirVenda ? 13 : 12} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando vendas...
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan={podeExcluirVenda ? 13 : 12} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                ) : (
                  vendas.map(venda => (
                    <tr
                      key={venda.id}
                      className={podeEditarVenda ? 'clickable-row' : ''}
                      role={podeEditarVenda ? 'button' : undefined}
                      tabIndex={podeEditarVenda ? 0 : undefined}
                      onClick={() => podeEditarVenda && abrirEdicao(venda)}
                      onKeyDown={(event) => {
                        if (!podeEditarVenda) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          abrirEdicao(venda);
                        }
                      }}
                    >
                      <td>
                        <div className="vendas-table-name">
                          <strong>{venda.cliente?.nome || venda.nome}</strong>
                          <span>{venda.cliente?.razao_social || venda.razao_social || venda.telefone || venda.email || '-'}</span>
                        </div>
                      </td>
                      <td><span className="tag">{venda.operadora?.nome || '-'}</span></td>
                      <td>{venda.tipoVenda?.nome || venda.produto_fechado || '-'}</td>
                      <td>{venda.servico?.nome || '-'}</td>
                      <td>{venda.quantidade_linhas || '-'}</td>
                      <td>{venda.gb || '-'}</td>
                      <td className="vendas-value">{formatarMoeda(venda.valor_total)}</td>
                      <td>{venda.dia_vencimento || '-'}</td>
                      <td>{formatarData(venda.data_venda)}</td>
                      <td>{formatarData(venda.data_ativacao)}</td>
                      <td><span className="tag">{venda.vendedora?.nome || '-'}</span></td>
                      <td className={`vendas-actions-col vendas-email-actions-col ${podeExcluirVenda ? 'has-delete' : ''}`}>
                        <button
                          className="btn btn-icon btn-ghost"
                          title="Gerar corpo de email"
                          disabled={gerandoEmailId === venda.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            abrirEmailVenda(venda);
                          }}
                        >
                          <I.Mail size={13} />
                        </button>
                        {/claro/i.test(venda.operadora?.nome) && (
                          <button
                            className="btn btn-icon btn-ghost"
                            title="Baixar planilha Claro"
                            disabled={baixandoXlsxId === venda.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleBaixarXlsxClaro(venda);
                            }}
                          >
                            <I.TableSheet size={13} />
                          </button>
                        )}
                      </td>
                      {podeExcluirVenda && (
                        <td className="vendas-actions-col vendas-delete-actions-col">
                          <button
                            className="btn btn-icon btn-ghost btn-danger-icon"
                            title="Excluir"
                            onClick={(event) => {
                              event.stopPropagation();
                              setVendaParaLixeira(venda);
                            }}
                          >
                            <I.Trash size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default VendasPage;
