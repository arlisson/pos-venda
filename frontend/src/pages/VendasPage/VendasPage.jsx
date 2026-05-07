import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import CnpjSugestoes, { formatarMensagemResumoCnpj } from '../../components/CnpjSugestoes';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import {
  atualizarVenda,
  baixarArquivoVenda,
  baixarPacoteArquivosVenda,
  baixarXlsxClaro,
  buscarProblemaAtivoVenda,
  buscarVendaPorId,
  criarVenda,
  deletarVenda,
  excluirArquivoVenda,
  gerarPacoteArquivosVenda,
  gerarEmailVenda,
  listarArquivosVenda,
  listarDestinatariosProblemaVenda,
  listarVendas,
  listarVendedoras,
  marcarProblemaVenda,
  resolverProblemaVenda,
  solicitarCorrecaoProblemaVenda,
  uploadArquivoVenda,
  verificarProblemaVenda,
  visualizarArquivoVenda
} from '../../services/venda.service';
import { consultarCnpj, sanitizarCnpj, validarDigitosCnpj } from '../../services/cnpj.service';
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
  numeros_ativados: [],
  gb: '',
  valores_unitarios_chips: [{ quantidade: '', gb: '', valor_unitario: '', tipo_linha: 'novo', vendedora_id: '' }],
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

const CNPJ_SUGESTOES_VENDA = {
  nomeFantasia: { campo: 'nome', label: 'Nome fantasia' },
  razaoSocial: { campo: 'razao_social', label: 'Razao social' },
  email: { campo: 'email', label: 'Email' },
  telefone: { campo: 'telefone', label: 'Telefone' },
  cep: { campo: 'cep', label: 'CEP' },
  endereco: { campo: 'endereco', label: 'Endereco' },
  numero: { campo: 'numero_endereco', label: 'Numero' },
  complemento: { campo: 'complemento', label: 'Complemento' },
  bairro: { campo: 'bairro', label: 'Bairro' },
  municipio: { campo: 'municipio', label: 'Municipio' },
  uf: { campo: 'uf', label: 'UF' }
};

const CNPJ_LABELS_VENDA = Object.fromEntries(
  Object.entries(CNPJ_SUGESTOES_VENDA).map(([campo, config]) => [campo, config.label])
);

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
  { name: 'data_ativacao', label: 'Data da ativação', type: 'date' },
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
  { name: 'numeros_ativados', label: 'Números ativados', type: 'activatedNumbers', span: true },
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

function validarCpf(valor) {
  const cpf = apenasDigitos(valor, 11);

  if (!cpf) return true;
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = tamanho => {
    let soma = 0;

    for (let i = 0; i < tamanho; i += 1) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function obterErroCpfVenda(form) {
  if (!validarCpf(form.cpf_representante_legal)) {
    return 'CPF RL inválido. Confira os 11 dígitos antes de salvar.';
  }

  if (!validarCpf(form.cpf_administrador)) {
    return 'CPF ADM inválido. Confira os 11 dígitos antes de salvar.';
  }

  return '';
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

function normalizarItensChipsInput(itens) {
  return Array.isArray(itens) ? itens : parseItensChips(itens);
}

function normalizarIdsVendedorasInput(vendedoras) {
  if (!Array.isArray(vendedoras)) return [];

  return Array.from(new Set(
    vendedoras
      .map(item => {
        if (item && typeof item === 'object') {
          return Number(item.id || item.usuario_id || item.vendedora_id);
        }

        return Number(item);
      })
      .filter(Number.isInteger)
      .filter(id => id > 0)
  ));
}

function calcularTotalItensChips(itens = []) {
  return normalizarItensChipsInput(itens).reduce((acc, item) => (
    acc + (Number(item.quantidade || 0) * parseValorInput(item.valor_unitario))
  ), 0);
}

function resumirGigasItensChips(itens = []) {
  const valores = normalizarItensChipsInput(itens)
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
  return normalizarItensChipsInput(itens).reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
}

function limitarItensChipsPorQuantidadeLinhas(itens = [], limiteQuantidade = 0) {
  const lista = normalizarItensChipsInput(itens);
  const limite = Number(limiteQuantidade || 0);

  if (limite <= 0) return lista;

  let restante = limite;

  return lista.map(item => {
    const quantidadeAtual = Number(item.quantidade || 0);
    const quantidade = Math.min(quantidadeAtual, restante);
    restante = Math.max(restante - quantidade, 0);

    return {
      ...item,
      quantidade: quantidade > 0 ? String(quantidade) : ''
    };
  });
}

function somarQuantidadePortabilidadeItensChips(itens = []) {
  return normalizarItensChipsInput(itens).reduce((acc, item) => (
    normalizarTipoLinhaChip(item.tipo_linha) === 'portabilidade'
      ? acc + Number(item.quantidade || 0)
      : acc
  ), 0);
}

function temChipPortabilidade(itens = []) {
  return somarQuantidadePortabilidadeItensChips(itens) > 0;
}

function formatarTipoLinhaChipLabel(tipo) {
  return normalizarTipoLinhaChip(tipo) === 'portabilidade' ? 'Portabilidade' : 'Novo';
}

function resumirTiposLinhaItensChips(itens = []) {
  const tipos = normalizarItensChipsInput(itens)
    .map(item => formatarTipoLinhaChipLabel(item.tipo_linha || item.tipo || item.categoria))
    .filter(Boolean);

  return Array.from(new Set(tipos)).join(', ');
}

function obterTipoVendaTabela(venda = {}) {
  return venda.tipoVenda?.nome
    || resumirTiposLinhaItensChips(venda.valores_unitarios_chips)
    || venda.produto_fechado
    || '-';
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
    .filter(item => apenasDigitos(item).length > 2)
    .join('\n');
}

const parseNumerosAtivados = parseNumerosPortados;
const montarNumerosAtivados = montarNumerosPortados;

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
    numeros_ativados: parseNumerosAtivados(venda.numeros_ativados),
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
        const outros = itens.reduce((acc, chip, itemIndex) => (
          itemIndex === index ? acc : acc + Number(chip.quantidade || 0)
        ), 0);
        const maximoQuantidadeLinha = limite > 0 ? Math.max(limite - outros, 0) : undefined;

        return (
          <div key={index} className="chip-item-row">
            <input
              type="number"
              min="1"
              max={maximoQuantidadeLinha}
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

function montarPrefixoDdd(ddd) {
  const digitos = apenasDigitos(ddd, 2);
  return digitos.length === 2 ? `(${digitos}) ` : '';
}

function numeroLinhaTemApenasDddOuVazio(valor) {
  return apenasDigitos(valor).length <= 2;
}

function ajustarQuantidadeNumerosPortados(value, quantidade, dddPadrao = '') {
  const total = Math.max(Number(quantidade || 0), 0);
  const prefixoDdd = montarPrefixoDdd(dddPadrao);
  if (total === 0) return [prefixoDdd || NUMERO_PORTADO_VAZIO];

  const atuais = Array.isArray(value) ? value : parseNumerosPortados(value);
  const preenchidos = atuais.length > 0 ? atuais : [NUMERO_PORTADO_VAZIO];

  return Array.from({ length: total }, (_, index) => {
    const atual = preenchidos[index] || NUMERO_PORTADO_VAZIO;
    return numeroLinhaTemApenasDddOuVazio(atual) ? (prefixoDdd || NUMERO_PORTADO_VAZIO) : atual;
  });
}

function NumerosLinhaInput({ value, onChange, quantidadeEsperada = 0, dddPadrao = '', labelAdicionar = 'Adicionar número' }) {
  const numeros = Array.isArray(value) && value.length > 0 ? value : [NUMERO_PORTADO_VAZIO];
  const limite = Math.max(Number(quantidadeEsperada || 0), 0);
  const limiteAtingido = limite > 0 && numeros.length >= limite;
  const numeroVazio = montarPrefixoDdd(dddPadrao) || NUMERO_PORTADO_VAZIO;

  function atualizarNumero(index, novoValor) {
    onChange(numeros.map((numero, numeroIndex) => (
      numeroIndex === index ? novoValor : numero
    )));
  }

  function adicionarNumero() {
    if (limiteAtingido) return;
    onChange([...numeros, numeroVazio]);
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
          <I.Plus size={13} /> {labelAdicionar}
        </button>
        {limite > 0 && <span>{numeros.length}/{limite} números</span>}
      </div>
    </div>
  );
}

function NumerosPortadosInput(props) {
  return <NumerosLinhaInput {...props} labelAdicionar="Adicionar número" />;
}

function NumerosAtivadosInput(props) {
  return <NumerosLinhaInput {...props} labelAdicionar="Adicionar número ativado" />;
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

function formatarTamanhoArquivo(bytes) {
  const tamanho = Number(bytes || 0);

  if (tamanho >= 1024 * 1024) {
    return `${(tamanho / 1024 / 1024).toFixed(1)} MB`;
  }

  if (tamanho >= 1024) {
    return `${(tamanho / 1024).toFixed(1)} KB`;
  }

  return `${tamanho} B`;
}

function labelStatusPacote(status) {
  const labels = {
    pendente: 'Pacote pendente',
    gerando: 'Gerando pacote',
    pronto: 'Pacote pronto',
    erro: 'Erro ao gerar pacote',
    desatualizado: 'Pacote desatualizado',
    inexistente: 'Sem pacote'
  };

  return labels[status] || 'Sem pacote';
}

function getIconStatusPacote(status) {
  if (status === 'pronto') return <I.Check size={12} />;
  if (status === 'erro' || status === 'desatualizado') return <I.AlertTriangle size={12} />;
  return <I.Note size={12} />;
}

function ArquivosVendaTab({ venda, podeEditar }) {
  const inputRef = useRef(null);
  const [arquivos, setArquivos] = useState([]);
  const [pacote, setPacote] = useState(null);
  const [categoria, setCategoria] = useState('documento');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');

  async function carregar() {
    if (!venda?.id) return;

    setCarregando(true);
    setErro('');

    try {
      const data = await listarArquivosVenda(venda.id);
      setArquivos(data.arquivos || []);
      setPacote(data.pacote || null);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar arquivos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venda?.id]);

  useEffect(() => {
    if (!['pendente', 'gerando'].includes(pacote?.status)) return undefined;

    const timer = setInterval(() => {
      carregar();
    }, 2500);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacote?.status, venda?.id]);

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) return;

    setEnviando(true);
    setErro('');

    try {
      for (const file of files) {
        setProgresso({ nome: file.name, valor: 0 });
        await uploadArquivoVenda(venda.id, file, { categoria }, valor => {
          setProgresso({ nome: file.name, valor });
        });
      }

      setProgresso(null);
      await carregar();
    } catch (error) {
      setErro(error.message || 'Erro ao enviar arquivo.');
    } finally {
      setEnviando(false);
      setProgresso(null);
    }
  }

  async function handleExcluir(arquivo) {
    if (!window.confirm(`Excluir o arquivo "${arquivo.nome_original}" desta venda?`)) return;

    setErro('');

    try {
      await excluirArquivoVenda(venda.id, arquivo.id);
      await carregar();
    } catch (error) {
      setErro(error.message || 'Erro ao excluir arquivo.');
    }
  }

  async function handleGerarPacote() {
    setErro('');

    try {
      const novoPacote = await gerarPacoteArquivosVenda(venda.id);
      setPacote(novoPacote);
    } catch (error) {
      setErro(error.message || 'Erro ao gerar pacote.');
    }
  }

  if (!venda?.id) {
    return (
      <div className="venda-arquivos-empty venda-arquivos-empty--blocked">
        <span className="venda-arquivos-empty__icon">
          <I.Note size={20} />
        </span>
        <strong>Venda ainda nao salva</strong>
        <span>Salve a venda antes de anexar arquivos.</span>
      </div>
    );
  }

  const statusPacote = pacote?.status || 'inexistente';
  const totalArquivos = arquivos.length;

  return (
    <div className="venda-arquivos">
      <div className="venda-arquivos-toolbar">
        <div className="venda-arquivos-heading">
          <div className="venda-arquivos-title-row">
            <div className="venda-arquivos-title">Arquivos da venda</div>
            <span className="venda-arquivos-count">
              {totalArquivos} {totalArquivos === 1 ? 'arquivo' : 'arquivos'}
            </span>
          </div>
          <div className={`venda-arquivos-package status-${statusPacote}`}>
            {getIconStatusPacote(statusPacote)}
            <span className="venda-arquivos-package__text">
              <span>{labelStatusPacote(statusPacote)}</span>
              {pacote?.total_arquivos ? <span>{pacote.total_arquivos} no ZIP</span> : null}
            </span>
          </div>
        </div>

        <div className="venda-arquivos-actions">
          <select aria-label="Categoria do arquivo" value={categoria} onChange={event => setCategoria(event.target.value)} disabled={!podeEditar || enviando}>
            <option value="documento">Documento</option>
            <option value="contrato">Contrato</option>
            <option value="comprovante">Comprovante</option>
            <option value="outro">Outro</option>
          </select>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={handleUpload}
          />
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={!podeEditar || enviando}>
            <I.Plus size={13} />
            {enviando ? 'Enviando...' : 'Enviar arquivos'}
          </button>
          <button type="button" className="btn" onClick={handleGerarPacote} disabled={!podeEditar || arquivos.length === 0 || pacote?.status === 'gerando'}>
            <I.Note size={13} />
            Gerar ZIP
          </button>
          <button type="button" className="btn" onClick={() => baixarPacoteArquivosVenda(venda.id)} disabled={pacote?.status !== 'pronto'}>
            <I.Download size={13} />
            Baixar ZIP
          </button>
        </div>
      </div>

      {progresso && (
        <div className="venda-arquivos-progress">
          <span>{progresso.nome}</span>
          <strong>{progresso.valor}%</strong>
        </div>
      )}

      {erro && <div className="alert-error">{erro}</div>}

      {carregando ? (
        <div className="venda-arquivos-empty">
          <span className="venda-arquivos-empty__icon">
            <I.Note size={20} />
          </span>
          <strong>Carregando arquivos...</strong>
        </div>
      ) : arquivos.length === 0 ? (
        <div className="venda-arquivos-empty venda-arquivos-empty--upload" role={podeEditar ? 'button' : undefined} tabIndex={podeEditar ? 0 : undefined} onClick={() => podeEditar && inputRef.current?.click()} onKeyDown={event => {
          if (!podeEditar) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}>
          <span className="venda-arquivos-empty__icon">
            <I.Plus size={20} />
          </span>
          <strong>Nenhum arquivo anexado</strong>
          <span>{podeEditar ? 'Clique para selecionar documentos, contratos ou comprovantes.' : 'Sem arquivos para exibir.'}</span>
          <em>PDF, JPG, PNG ou WEBP</em>
        </div>
      ) : (
        <div className="venda-arquivos-list">
          {arquivos.map(arquivo => (
            <div key={arquivo.id} className="venda-arquivo-item">
              <div className="venda-arquivo-icon">
                <I.Note size={16} />
              </div>
              <div className="venda-arquivo-main">
                <strong>{arquivo.nome_original}</strong>
                <div className="venda-arquivo-meta">
                  {arquivo.categoria} · {formatarTamanhoArquivo(arquivo.arquivo?.tamanho_bytes)} · {arquivo.criado_por?.nome || 'Usuário'}
                  {arquivo.arquivo?.removido_em ? ' · arquivado no ZIP' : ''}
                </div>
              </div>
              <div className="venda-arquivo-actions">
                <button type="button" className="btn btn-sm" onClick={() => visualizarArquivoVenda(venda.id, arquivo.id)} disabled={Boolean(arquivo.arquivo?.removido_em)}>
                  <I.Eye size={12} />
                  Visualizar
                </button>
                <button type="button" className="btn btn-sm" onClick={() => baixarArquivoVenda(venda.id, arquivo.id, arquivo.nome_original)} disabled={Boolean(arquivo.arquivo?.removido_em)}>
                  <I.Download size={12} />
                  Baixar
                </button>
                {podeEditar && (
                  <button type="button" className="btn btn-sm btn-ghost vendas-trash-delete" onClick={() => handleExcluir(arquivo)}>
                    <I.Trash size={12} />
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pacote?.status === 'erro' && (
        <div className="alert-error">
          {pacote.erro || 'Não foi possível gerar o pacote.'}
        </div>
      )}
    </div>
  );
}

function VendaProblemaPanel({ venda, usuario }) {
  const [problema, setProblema] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagemResolucao, setMensagemResolucao] = useState('');
  const [mensagemCorrecao, setMensagemCorrecao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (!venda?.id) return;

    setCarregando(true);
    setErro('');

    try {
      setProblema(await buscarProblemaAtivoVenda(venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar problema da venda.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venda?.id]);

  if (!venda?.id) {
    return <div className="venda-problema-empty">Salve a venda antes de acompanhar problemas.</div>;
  }

  if (carregando) {
    return <div className="venda-problema-empty">Carregando problema da venda...</div>;
  }

  if (!problema) {
    return <div className="venda-problema-empty">Nenhum problema ativo para esta venda.</div>;
  }

  const usuarioId = Number(usuario?.id);
  const solicitanteId = Number(problema.solicitante_id);
  const responsavel = (problema.destinatarios || []).some(item => Number(item.usuario_id) === usuarioId);
  const solicitante = solicitanteId === usuarioId;
  const podeResolver = responsavel && problema.status !== 'resolvido';
  const podeRevisar = solicitante && problema.status === 'resolvido';

  async function executar(acao) {
    setErro('');
    setSalvando(true);

    try {
      let atualizado;

      if (acao === 'resolver') {
        atualizado = await resolverProblemaVenda(problema.id, { mensagem: mensagemResolucao });
        setMensagemResolucao('');
      } else if (acao === 'correcao') {
        atualizado = await solicitarCorrecaoProblemaVenda(problema.id, { mensagem: mensagemCorrecao });
        setMensagemCorrecao('');
      } else {
        atualizado = await verificarProblemaVenda(problema.id);
      }

      setProblema(atualizado?.status === 'verificado' ? null : atualizado);
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    } catch (error) {
      setErro(error.message || 'Erro ao atualizar problema da venda.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="venda-problema-panel">
      <div className={`venda-problema-status status-${problema.status}`}>
        <strong>{problema.status === 'resolvido' ? 'Aguardando verificação' : problema.status === 'correcao_solicitada' ? 'Correção solicitada' : 'Problema aberto'}</strong>
        <span>Solicitado por {problema.solicitante?.nome || 'usuário'}.</span>
      </div>

      <div className="venda-problema-responsaveis">
        <strong>Responsáveis</strong>
        <span>{(problema.destinatarios || []).map(item => item.usuario?.nome).filter(Boolean).join(', ') || '-'}</span>
      </div>

      <div className="venda-problema-eventos">
        {(problema.eventos || []).map(evento => (
          <div key={evento.id} className="venda-problema-evento">
            <strong>{evento.usuario?.nome || 'Sistema'} - {evento.tipo}</strong>
            <span>{evento.mensagem}</span>
            <em>{formatarData(evento.created_at)}</em>
          </div>
        ))}
      </div>

      {erro && <div className="alert-error">{erro}</div>}

      {podeResolver && (
        <div className="venda-problema-action">
          <label>Mensagem de resolução</label>
          <AutoResizeTextarea value={mensagemResolucao} onChange={event => setMensagemResolucao(event.target.value)} placeholder="Explique o que foi corrigido" />
          <button type="button" className="btn btn-primary" disabled={salvando || !mensagemResolucao.trim()} onClick={() => executar('resolver')}>
            Marcar resolvido
          </button>
        </div>
      )}

      {podeRevisar && (
        <div className="venda-problema-action">
          <div className="venda-problema-review-actions">
            <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => executar('verificar')}>
              Verificado
            </button>
          </div>
          <label>Solicitar nova correção</label>
          <AutoResizeTextarea value={mensagemCorrecao} onChange={event => setMensagemCorrecao(event.target.value)} placeholder="Descreva o que ainda precisa ser ajustado" />
          <button type="button" className="btn" disabled={salvando || !mensagemCorrecao.trim()} onClick={() => executar('correcao')}>
            Enviar correção
          </button>
        </div>
      )}
    </div>
  );
}

function MarcarProblemaModal({ venda, usuarios, onClose, onSave }) {
  const [motivo, setMotivo] = useState('');
  const [modo, setModo] = useState('responsaveis');
  const [destinatarios, setDestinatarios] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    setSalvando(true);

    try {
      await onSave(venda, {
        motivo,
        modo_destinatario: modo === 'manual' ? 'manual' : 'responsaveis',
        destinatarios
      });
    } catch (error) {
      setErro(error.message || 'Erro ao marcar problema.');
    } finally {
      setSalvando(false);
    }
  }

  function toggleUsuario(id) {
    setDestinatarios(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  }

  return (
    <div className="modal-overlay venda-problema-modal-overlay" onClick={onClose}>
      <div className="modal venda-problema-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Marcar venda com problema</div>
              <div className="modal-sub">{venda?.cliente?.nome || venda?.nome || `Venda #${venda?.id}`}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose}>
              <I.Close size={14} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          {erro && <div className="alert-error">{erro}</div>}
          <div className="form-field">
            <label>Motivo do problema</label>
            <AutoResizeTextarea value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Explique por que esta venda está com problema" />
          </div>
          <div className="venda-problema-recipient-mode">
            <label>
              <input type="radio" checked={modo === 'responsaveis'} onChange={() => setModo('responsaveis')} />
              Enviar aos responsáveis da venda
            </label>
            <label>
              <input type="radio" checked={modo === 'manual'} onChange={() => setModo('manual')} />
              Escolher manualmente
            </label>
          </div>
          {modo === 'manual' && (
            <div className="venda-problema-user-list">
              {usuarios.map(usuario => (
                <label key={usuario.id}>
                  <input type="checkbox" checked={destinatarios.includes(usuario.id)} onChange={() => toggleUsuario(usuario.id)} />
                  <span>{usuario.nome}</span>
                  <em>{usuario.email}</em>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-danger" disabled={salvando || !motivo.trim() || (modo === 'manual' && destinatarios.length === 0)} onClick={salvar}>
            {salvando ? 'Enviando...' : 'Marcar problema'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VendaModal({
  venda,
  initialValues,
  clientes,
  vendedoras,
  operadoras,
  tiposVenda,
  servicos,
  podeEditarVenda,
  podeVerDocumentosVenda,
  usuarioLogado,
  initialTab = 'venda',
  modoEdicao = true,
  onStartEdit,
  onClose,
  onSave,
  onCreateClient
}) {
  const [form, setForm] = useState(venda ? normalizarVenda(venda) : { ...VENDA_VAZIA, ...(initialValues || {}) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [cepStatus, setCepStatus] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [cnpjDados, setCnpjDados] = useState(null);
  const [cnpjSugestoes, setCnpjSugestoes] = useState({});
  const abaInicial = initialTab === 'arquivos' && !podeVerDocumentosVenda ? 'venda' : initialTab;
  const [abaAtiva, setAbaAtiva] = useState(abaInicial);
  const somenteVisualizacao = Boolean(venda) && !modoEdicao;
  const ultimoCnpjConsultadoRef = useRef(venda ? sanitizarCnpj(form.cnpj) : '');
  const cepPreenchidoPorCnpjRef = useRef('');
  const vendaPortabilidade = temChipPortabilidade(form.valores_unitarios_chips);
  const quantidadePortabilidade = somarQuantidadePortabilidadeItensChips(form.valores_unitarios_chips || []);
  const vendaAtivada = Boolean(normalizarDataVendaInput(form.data_ativacao));
  const quantidadeLinhasFechadas = Number(form.quantidade_linhas || 0);
  const quantidadeChipsVenda = somarQuantidadeItensChips(form.valores_unitarios_chips || []);
  const quantidadeNumerosAtivados = quantidadeChipsVenda || quantidadeLinhasFechadas;
  function atualizarCampo(campo, valor) {
    if (somenteVisualizacao) return;

    const valorFormatado = formatarCampoVenda(campo, valor);

    setForm(prev => {
      const proximo = {
        ...prev,
        [campo]: valorFormatado
      };

      if (campo === 'quantidade_linhas') {
        proximo.valores_unitarios_chips = limitarItensChipsPorQuantidadeLinhas(
          prev.valores_unitarios_chips,
          valorFormatado
        );
      }

      if (campo === 'valores_unitarios_chips') {
        proximo.valores_unitarios_chips = limitarItensChipsPorQuantidadeLinhas(
          valorFormatado,
          prev.quantidade_linhas
        );
      }

      return proximo;
    });
  }

  function formatarMensagemCnpj(dados) {
    return formatarMensagemResumoCnpj(dados);
  }

  function montarSugestoesCnpj(dados) {
    return Object.entries(CNPJ_SUGESTOES_VENDA).reduce((acc, [campoApi]) => {
      const valor = dados[campoApi];
      if (String(valor || '').trim()) acc[campoApi] = valor;
      return acc;
    }, {});
  }

  function atualizarClienteVenda(valor) {
    if (somenteVisualizacao) return;

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

  function atualizarVendedorasVenda(ids) {
    if (somenteVisualizacao) return;

    setForm(prev => ({ ...prev, vendedoras: ids }));
  }

  function aceitarSugestaoCnpj(campoApi) {
    const valor = cnpjSugestoes[campoApi];
    const config = CNPJ_SUGESTOES_VENDA[campoApi];
    if (!config || !String(valor || '').trim()) return;

    setForm(prev => {
      let valorFormatado = valor;
      if (campoApi === 'cep') {
        valorFormatado = formatarCep(valor);
        cepPreenchidoPorCnpjRef.current = apenasDigitos(valorFormatado, 8);
      } else if (campoApi === 'telefone') {
        valorFormatado = formatarTelefoneComDdd(valor, true);
      } else if (campoApi === 'uf') {
        valorFormatado = formatarCampoVenda('uf', valor);
      }

      return {
        ...prev,
        [config.campo]: valorFormatado
      };
    });

    setCnpjSugestoes(prev => {
      const proximo = { ...prev };
      delete proximo[campoApi];
      return proximo;
    });
  }

  async function buscarDadosCnpj(manual = false) {
    if (somenteVisualizacao) return;

    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length !== 14) {
      if (manual) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'Informe um CNPJ com 14 dígitos.' });
      }
      return;
    }

    if (!validarDigitosCnpj(cnpj)) {
      setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
      setCnpjDados(null);
      setCnpjSugestoes({});
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
      setCnpjDados(dados);
      setCnpjSugestoes(montarSugestoesCnpj(dados));
      setCnpjStatus({
        tipo: 'sucesso',
        mensagem: formatarMensagemCnpj(dados)
      });
    } catch (error) {
      setCnpjDados(null);
      setCnpjSugestoes({});
      setCnpjStatus({ tipo: 'erro', mensagem: error.message || 'Não foi possível consultar o CNPJ.' });
    } finally {
      setConsultandoCnpj(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (abaAtiva === 'arquivos' && !podeVerDocumentosVenda) {
      setAbaAtiva('venda');
    }
  }, [abaAtiva, podeVerDocumentosVenda]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (somenteVisualizacao) return;

    const cnpj = sanitizarCnpj(form.cnpj);

    if (cnpj.length === 0) {
      setCnpjStatus({ tipo: '', mensagem: '' });
      setCnpjDados(null);
      setCnpjSugestoes({});
      return;
    }

    if (cnpj.length === 14) {
      if (!validarDigitosCnpj(cnpj)) {
        setCnpjStatus({ tipo: 'erro', mensagem: 'CNPJ inválido.' });
        setCnpjDados(null);
        setCnpjSugestoes({});
        return;
      }

      buscarDadosCnpj(false);
    }
  }, [form.cnpj, somenteVisualizacao]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (somenteVisualizacao) return;

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
  }, [form.cep, somenteVisualizacao]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (somenteVisualizacao) return;
    if (!vendaPortabilidade) return;

    setForm(prev => ({
      ...prev,
      numeros_portados: ajustarQuantidadeNumerosPortados(prev.numeros_portados, quantidadePortabilidade, prev.ddd)
    }));
  }, [vendaPortabilidade, quantidadePortabilidade, form.ddd]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (somenteVisualizacao) return;

    if (!vendaAtivada) {
      if (Array.isArray(form.numeros_ativados) && form.numeros_ativados.length === 0) return;
      setForm(prev => ({ ...prev, numeros_ativados: [] }));
      return;
    }

    setForm(prev => ({
      ...prev,
      numeros_ativados: ajustarQuantidadeNumerosPortados(prev.numeros_ativados, quantidadeNumerosAtivados, prev.ddd)
    }));
  }, [somenteVisualizacao, vendaAtivada, quantidadeNumerosAtivados, form.ddd]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleStartEdit(event) {
    event.preventDefault();
    event.stopPropagation();
    setErro('');
    setSalvando(false);
    onStartEdit();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (somenteVisualizacao) {
      return;
    }

    setErro('');
    setSalvando(true);

    try {
      if (!form.cliente_id) {
        setErro('Selecione um cliente para cadastrar a venda.');
        setSalvando(false);
        return;
      }

      const vendedorasIds = normalizarIdsVendedorasInput(form.vendedoras);

      if (vendedorasIds.length === 0) {
        setErro('Selecione pelo menos uma vendedora para cadastrar a venda.');
        setSalvando(false);
        return;
      }

      const erroCpf = obterErroCpfVenda(form);

      if (erroCpf) {
        setErro(erroCpf);
        setSalvando(false);
        return;
      }

      const numerosPortados = montarNumerosPortados(form.numeros_portados);
      const numerosAtivados = montarNumerosAtivados(form.numeros_ativados);
      const quantidadeChips = somarQuantidadeItensChips(form.valores_unitarios_chips || []);

      if (quantidadeLinhasFechadas > 0 && quantidadeChips > quantidadeLinhasFechadas) {
        setErro('A quantidade de chips não pode ser maior que a quantidade de linhas fechadas.');
        setSalvando(false);
        return;
      }

      if (vendaPortabilidade && !numerosPortados) {
        setErro('Informe pelo menos um número a ser portado.');
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
        numeros_ativados: form.data_ativacao ? numerosAtivados : null,
        valores_unitarios_chips: chipsProcessados,
        vendedoras: vendedorasIds
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
      <form className="modal venda-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{venda ? (somenteVisualizacao ? 'Visualizar venda' : 'Editar venda') : 'Nova venda'}</div>
              <div className="modal-sub">
                {somenteVisualizacao
                  ? 'Revise os dados cadastrados antes de editar.'
                  : 'Selecione o cliente e preencha apenas os dados específicos da venda.'}
              </div>
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
          {podeVerDocumentosVenda && (
            <button
              type="button"
              className={`modal-tab ${abaAtiva === 'arquivos' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('arquivos')}
            >
              <I.Note size={14} /> Documentos
            </button>
          )}
          <button
            type="button"
            className={`modal-tab ${abaAtiva === 'problema' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('problema')}
          >
            <I.AlertTriangle size={14} /> Problema
          </button>
        </div>

        {erro && abaAtiva === 'venda' && (
          <div className="venda-modal-alert" role="alert" aria-live="assertive">
            <div className="venda-modal-alert__icon">
              <I.AlertTriangle size={16} />
            </div>
            <div className="venda-modal-alert__content">
              <strong>Não foi possível salvar a venda</strong>
              <span>{erro}</span>
            </div>
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              onClick={() => setErro('')}
              title="Fechar aviso"
            >
              <I.Close size={13} />
            </button>
          </div>
        )}

        <div className="modal-body">
          {abaAtiva === 'notas' ? (
            <NotasEntidadeTab tipo="venda" entidadeId={venda?.id} />
          ) : abaAtiva === 'arquivos' && podeVerDocumentosVenda ? (
            <ArquivosVendaTab venda={venda} podeEditar={podeEditarVenda} />
          ) : abaAtiva === 'problema' ? (
            <VendaProblemaPanel venda={venda} usuario={usuarioLogado} />
          ) : (
          <>
            <fieldset className="venda-readonly-fieldset" disabled={somenteVisualizacao}>
            <div className="vendas-form-grid">
            {CAMPOS.map(campo => {
              if (campo.section) {
                return <div key={campo.section} className="vendas-form-section">{campo.section}</div>;
              }

              if (campo.name === 'numeros_portados' && !vendaPortabilidade) {
                return null;
              }

              if (campo.name === 'numeros_ativados' && !vendaAtivada) {
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
                      <CnpjSugestoes
                        dados={cnpjDados}
                        sugestoes={cnpjSugestoes}
                        labels={CNPJ_LABELS_VENDA}
                        onAceitar={aceitarSugestaoCnpj}
                      />
                    </>
                  ) : campo.type === 'sellers' ? (
                    <VendedorasSelect
                      value={form.vendedoras || []}
                      options={vendedoras}
                      onChange={atualizarVendedorasVenda}
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
                      dddPadrao={form.ddd}
                    />
                  ) : campo.type === 'activatedNumbers' ? (
                    <NumerosAtivadosInput
                      value={form[campo.name]}
                      onChange={valor => atualizarCampo(campo.name, valor)}
                      quantidadeEsperada={quantidadeNumerosAtivados}
                      dddPadrao={form.ddd}
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
          </fieldset>

          </>
          )}
        </div>

        <div className="modal-footer">
          {abaAtiva === 'notas' || abaAtiva === 'arquivos' || abaAtiva === 'problema' ? (
            <button type="button" className="btn" onClick={onClose}>Fechar</button>
          ) : somenteVisualizacao ? (
            <>
              <button type="button" className="btn" onClick={onClose}>Fechar</button>
              {podeEditarVenda && (
                <button type="button" className="btn btn-primary" onClick={handleStartEdit}>
                  <I.Edit size={14} /> Editar venda
                </button>
              )}
            </>
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
  const [usuariosProblema, setUsuariosProblema] = useState([]);
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
  const [modalAbaInicial, setModalAbaInicial] = useState('venda');
  const [modalModoEdicao, setModalModoEdicao] = useState(true);
  const [vendaInicial, setVendaInicial] = useState(null);
  const [vendaParaLixeira, setVendaParaLixeira] = useState(null);
  const [vendaProblema, setVendaProblema] = useState(null);
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
  const podeVerDocumentosVenda = temPermissao(usuarioLogado, 'vendas_documentos');
  const podeMarcarProblema = temPermissao(usuarioLogado, 'vendas_marcar_problema');
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
    uf,
    municipio,
    data_inicio: dataInicio,
    data_fim: dataFim,
    valor_min: valorMin,
    valor_max: valorMax
  }), [busca, vendedoraId, operadoraId, tipoVendaId, servicoId, statusFunil, prioridadeFunil, uf, municipio, dataInicio, dataFim, valorMin, valorMax]);

  const filtrosAtivos = useMemo(() => (
    Object.entries(filtros).filter(([, valor]) => valor !== '').length
  ), [filtros]);

  const filtrosPopupAtivos = [
    operadoraId,
    tipoVendaId,
    servicoId,
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
      const [vendasData, clientesData, vendedorasData, operadorasData, tiposVendaData, servicosData, etapasFunilData, usuariosProblemaData] = await Promise.all([
        listarVendas(filtros),
        podeListarClientes ? listarClientes() : Promise.resolve([]),
        listarVendedoras(),
        listarOperadoras(),
        listarTiposVenda(),
        listarServicos(),
        listarEtapasFunil(),
        podeMarcarProblema ? listarDestinatariosProblemaVenda() : Promise.resolve([])
      ]);

      setVendas(vendasData);
      setClientes(clientesData);
      setVendedoras(vendedorasData);
      setOperadoras(operadorasData);
      setTiposVenda(tiposVendaData);
      setServicos(servicosData);
      setStatusFunilFiltros(normalizarStatusFunilFiltros(etapasFunilData));
      setUsuariosProblema(usuariosProblemaData || []);
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
    setModalAbaInicial('venda');
    setModalModoEdicao(true);
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const vendaId = searchParams.get('venda_id');
    const abaParam = searchParams.get('aba');
    const abasPermitidas = ['venda', 'notas', ...(podeVerDocumentosVenda ? ['arquivos'] : []), 'problema'];
    const aba = abasPermitidas.includes(abaParam) ? abaParam : 'venda';

    if (!vendaId) return;

    buscarVendaPorId(vendaId)
      .then(venda => {
        setModalVenda(venda);
        setModalAbaInicial(aba);
        setModalModoEdicao(false);
        setVendaInicial(null);
        setModalAberto(true);
        navigate('/vendas', { replace: true });
      })
      .catch(error => setErro(error.message || 'Erro ao abrir venda.'));
  }, [searchParams, navigate, podeVerDocumentosVenda]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function abrirVisualizacao(venda) {
    setModalVenda(venda);
    setModalAbaInicial('venda');
    setModalModoEdicao(false);
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
    setModalAbaInicial('venda');
    setModalModoEdicao(true);
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
    setUf('');
    setMunicipio('');
    setDataInicio('');
    setDataFim('');
    setValorMin('');
    setValorMax('');
  }

  const totalColunasVendas = 12 + (podeMarcarProblema ? 1 : 0) + (podeExcluirVenda ? 1 : 0);

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
          podeEditarVenda={podeEditarVenda}
          podeVerDocumentosVenda={podeVerDocumentosVenda}
          usuarioLogado={usuarioLogado}
          initialTab={modalAbaInicial}
          modoEdicao={modalModoEdicao}
          onStartEdit={() => setModalModoEdicao(true)}
          onClose={() => {
            setModalAberto(false);
            setModalVenda(null);
            setModalAbaInicial('venda');
            setModalModoEdicao(true);
            setVendaInicial(null);
          }}
          onSave={salvarVenda}
          onCreateClient={() => navigate('/clientes/novo')}
        />
      )}

      {vendaProblema && (
        <MarcarProblemaModal
          venda={vendaProblema}
          usuarios={usuariosProblema}
          onClose={() => setVendaProblema(null)}
          onSave={async (venda, dados) => {
            await marcarProblemaVenda(venda.id, dados);
            setVendaProblema(null);
            setSucesso('Problema da venda enviado aos responsáveis.');
            window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
            await carregarDados();
          }}
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
              placeholder="Buscar por protocolo, nome, telefone, tipo, produto, CNPJ ou cidade"
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
                  <th>Ativação</th>
                  <th>Vendedor(a)</th>
                  <th className={`vendas-actions-col vendas-email-actions-col ${podeExcluirVenda ? 'has-delete' : ''}`}>Email</th>
                  {podeMarcarProblema && (
                    <th className="vendas-actions-col vendas-delete-actions-col">Problema</th>
                  )}
                  {podeExcluirVenda && (
                    <th className="vendas-actions-col vendas-delete-actions-col">Excluir</th>
                  )}  
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={totalColunasVendas} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Carregando vendas...
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan={totalColunasVendas} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                ) : (
                  vendas.map(venda => (
                    <tr
                      key={venda.id}
                      className="clickable-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirVisualizacao(venda)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          abrirVisualizacao(venda);
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
                      <td>{obterTipoVendaTabela(venda)}</td>
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
                      {podeMarcarProblema && (
                        <td className="vendas-actions-col vendas-delete-actions-col">
                          <button
                            className="btn btn-icon btn-ghost btn-danger-icon"
                            title="Marcar problema"
                            onClick={(event) => {
                              event.stopPropagation();
                              setVendaProblema(venda);
                            }}
                          >
                            <I.AlertTriangle size={13} />
                          </button>
                        </td>
                      )}
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
