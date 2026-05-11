import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AutoResizeTextarea from '../../components/AutoResizeTextarea';
import CnpjSugestoes, { formatarMensagemResumoCnpj } from '../../components/CnpjSugestoes';
import NotasEntidadeTab from '../../components/NotasEntidadeTab';
import * as I from '../../components/Icons';
import {
  atualizarVenda,
  baixarArquivoVenda,
  baixarPacoteArquivosVenda,
  baixarXlsxClaro,
  buscarVendaPorId,
  criarVenda,
  deletarVenda,
  enviarVendaParaPosVenda,
  excluirArquivoVenda,
  gerarPacoteArquivosVenda,
  gerarEmailVenda,
  listarArquivosVenda,
  listarDestinatariosProblemaVenda,
  listarProblemasVenda,
  listarVendas,
  listarVendedoras,
  marcarProblemaVenda,
  resolverProblemaVenda,
  solicitarCorrecaoProblemaVenda,
  uploadArquivoVenda,
  verificarProblemaVenda,
  visualizarArquivoVenda
} from '../../services/venda.service';
import { consultarCnpj, sanitizarCnpj, validarDigitosCnpj, sanitizarCpf, formatarCpf, validarDigitosCpf } from '../../services/cnpj.service';
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
  rg_representante_legal: '',
  data_nascimento_representante_legal: '',
  telefone_representante_legal: '',
  email_representante_legal: '',
  // Administrador
  nome_administrador: '',
  cpf_administrador: '',
  rg_administrador: '',
  data_nascimento_administrador: '',
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
  cliente_solicitou_servicos: [],
  cliente_solicitou_bloqueio_qtd: '',
  cliente_solicitou_cancelamento_qtd: '',
  cliente_solicitou_numeros: { bloqueio: [], cancelamento: [] },
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
  endereco_real_divergente: false,
  cep_real: '',
  endereco_real: '',
  numero_endereco_real: '',
  complemento_real: '',
  bairro_real: '',
  municipio_real: '',
  uf_real: '',
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
  numero_cliente_contrato: '',
  responsavel_recebimento: '',
  rg_responsavel_recebimento: '',
  responsavel_recebimento_2: '',
  rg_responsavel_recebimento_2: '',
  responsavel_recebimento_3: '',
  rg_responsavel_recebimento_3: '',
  observacoes: '',
  // Referências
  operadora_id: '',
  operadora_atual_id: '',
  vendedora_id: '',
  vendedoras: []
};

const CNPJ_SUGESTOES_VENDA = {
  nomeFantasia: { campo: 'nome', label: 'Nome fantasia' },
  razaoSocial: { campo: 'razao_social', label: 'Razão social' },
  email: { campo: 'email', label: 'Email' },
  telefone: { campo: 'telefone', label: 'Telefone' },
  cep: { campo: 'cep', label: 'CEP' },
  endereco: { campo: 'endereco', label: 'Endereço' },
  numero: { campo: 'numero_endereco', label: 'Número' },
  complemento: { campo: 'complemento', label: 'Complemento' },
  bairro: { campo: 'bairro', label: 'Bairro' },
  municipio: { campo: 'municipio', label: 'Município' },
  uf: { campo: 'uf', label: 'UF' }
};

const CNPJ_LABELS_VENDA = Object.fromEntries(
  Object.entries(CNPJ_SUGESTOES_VENDA).map(([campo, config]) => [campo, config.label])
);

const CAMPOS_ENDERECO_REAL_VENDA = [
  { name: 'cep_real', label: 'CEP' },
  { name: 'endereco_real', label: 'Endereço real', type: 'longText', span: true },
  { name: 'numero_endereco_real', label: 'Número' },
  { name: 'complemento_real', label: 'Complemento', type: 'longText', span: true },
  { name: 'bairro_real', label: 'Bairro' },
  { name: 'municipio_real', label: 'Município' },
  { name: 'uf_real', label: 'UF', maxLength: 2 }
];

const ITEM_CHIP_VAZIO = { quantidade: '', gb: '', valor_unitario: '', tipo_linha: 'novo', vendedora_id: '' };
const NUMERO_PORTADO_VAZIO = '';
const TIPOS_LINHA_CHIP = [
  { value: 'novo', label: 'Novo' },
  { value: 'portabilidade', label: 'Port.' }
];

const CLIENTE_SOLICITOU_OPCOES = [
  { value: 'bloqueio', label: 'Bloqueio' },
  { value: 'cancelamento', label: 'Cancelamento' },
  { value: 'nenhum_servico', label: 'Nenhum serviço' }
];

const CLIENTE_SOLICITOU_ACOES = ['bloqueio', 'cancelamento'];

const DIAS_SEMANA = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const FECHOU_VENDA_OPCOES = [
  { value: 'RL', label: 'RL' },
  { value: 'ADM', label: 'ADM' }
];

const CAMPOS_CPF_VENDA = ['cpf_representante_legal', 'cpf_administrador'];

const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99
]);

function validarNumeroTelefone(valor) {
  const digitos = (valor || '').replace(/\D/g, '');
  if (digitos.length < 10) return { valido: false, motivo: 'Número muito curto' };
  if (digitos.length > 11) return { valido: false, motivo: 'Número muito longo' };
  const ddd = Number(digitos.substring(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return { valido: false, motivo: `DDD ${ddd} inválido` };
  return { valido: true, motivo: '' };
}

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
  { name: 'rg_representante_legal', label: 'RG RL' },
  { name: 'data_nascimento_representante_legal', label: 'Data de nascimento RL', type: 'date' },
  { name: 'telefone_representante_legal', label: 'Telefone RL' },
  { name: 'email_representante_legal', label: 'Email RL' },

  { section: 'Administrador (ADM)' },
  { name: 'nome_administrador', label: 'Nome ADM' },
  { name: 'cpf_administrador', label: 'CPF ADM' },
  { name: 'rg_administrador', label: 'RG ADM' },
  { name: 'data_nascimento_administrador', label: 'Data de nascimento ADM', type: 'date' },
  { name: 'telefone_administrador', label: 'Telefone ADM' },
  { name: 'email_administrador', label: 'E-mail ADM' },

  { section: 'Dados da venda' },
  { name: 'data_venda', label: 'Data da venda', type: 'date' },
  { name: 'data_ativacao', label: 'Data da ativação', type: 'date' },
  { name: 'nome_fechou_venda', label: 'Venda fechada com', type: 'closedWith' },
  { name: 'setor_funcao', label: 'Setor/Função' },
  { name: 'qc_feito_por', label: 'QC feito por' },

  { section: 'Produto e valores' },
  { name: 'operadora_atual_id', label: 'Operadora atual', type: 'operator' },
  { name: 'operadora_id', label: 'Vai para operadora:', type: 'operator', required: true },
  { name: 'servico_id', label: 'Produto', type: 'service', required: true },
  { name: 'quantidade_linhas', label: 'Quantidade de linhas fechadas', type: 'number' },
  { name: 'ddd', label: 'Qual DDD' },
  { name: 'dia_vencimento', label: 'Dia de vencimento', type: 'number', min: 1, max: 31 },
  { name: 'cliente_solicitou_servicos', label: 'Cliente solicitou', type: 'clientRequested', span: true, required: true },
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
  { name: 'endereco_real_divergente', label: 'Endereço da Receita não é o endereço real', type: 'realAddressToggle', span: true },
  { name: 'ponto_referencia', label: 'Ponto de referência', type: 'longText', span: true },
  { name: 'tipo_local_cpf', label: 'Venda CPF: casa, hotel, condomínio, shopping...', type: 'longText', span: true },

  { section: 'Aceite e recebimento' },
  { name: 'horario_aceite_range', label: 'Janela do aceite', type: 'timeRange', nameDe: 'horario_aceite_inicio', nameAte: 'horario_aceite_fim', labelDe: 'De', labelAte: 'Até', span: true },
  { name: 'dia_aceite_range', label: 'Dias para aceite', type: 'dayRange', nameDe: 'dia_aceite_inicio', nameAte: 'dia_aceite_fim', labelDe: 'De', labelAte: 'Até', span: true },
  { name: 'protocolo', label: 'Protocolo do Cliente', span: true },
  { name: 'login', label: 'Login (portal do cliente)' },
  { name: 'senha', label: 'Senha (portal do cliente)' },
  { name: 'numero_cliente_contrato', label: 'Número do cliente no contrato', placeholder: 'Caso não tenha Login e Senha', span: true },
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

function obterErroCpfCampo(campo, valor) {
  if (!CAMPOS_CPF_VENDA.includes(campo)) return '';

  const cpf = apenasDigitos(valor, 11);
  if (!cpf) return '';
  if (cpf.length < 11) return 'CPF incompleto.';
  if (!validarCpf(valor)) return 'CPF invalido.';

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
  if (campo === 'cep' || campo === 'cep_real') return formatarCep(valor);
  if (campo === 'uf' || campo === 'uf_real') return String(valor || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
  if (campo === 'ddd') return apenasDigitos(valor, 2);
  if (campo === 'gb') return apenasDigitos(valor, 4);
  if (campo === 'quantidade_linhas') return apenasDigitos(valor, 4);
  if (campo === 'dia_vencimento') return formatarDiaVencimento(valor);
  return valor;
}

function getInputModeCampo(campo) {
  if ([
    'telefone', 'fixo_ddd', 'telefone_representante_legal', 'telefone_administrador',
    'cpf_representante_legal', 'cpf_administrador', 'cnpj', 'cep', 'cep_real', 'ddd', 'gb', 'quantidade_linhas', 'dia_vencimento'
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
    cep_real: 9,
    ddd: 2,
    gb: 4,
    uf: 2,
    uf_real: 2,
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

function getChaveClienteVenda(venda = {}) {
  if (venda.cliente_id) return `cliente:${venda.cliente_id}`;
  if (venda.cliente?.id) return `cliente:${venda.cliente.id}`;

  const cnpj = sanitizarCnpj(venda.cnpj || venda.cliente?.cnpj || '');
  if (cnpj) return `cnpj:${cnpj}`;

  const nome = normalizarTextoBusca(venda.nome || venda.cliente?.nome || venda.razao_social || venda.cliente?.razao_social || '');
  return nome ? `nome:${nome}` : '';
}

function contarVendasPorCliente(vendas = []) {
  return vendas.reduce((acc, venda) => {
    const chave = getChaveClienteVenda(venda);
    if (!chave) return acc;
    acc.set(chave, (acc.get(chave) || 0) + 1);
    return acc;
  }, new Map());
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

function parseClienteSolicitouServicos(valor) {
  if (!valor) return [];

  if (Array.isArray(valor)) {
    const servicos = valor
      .map(item => String(item || '').trim())
      .filter(item => CLIENTE_SOLICITOU_OPCOES.some(opcao => opcao.value === item));

    return servicos.includes('nenhum_servico')
      ? ['nenhum_servico']
      : CLIENTE_SOLICITOU_ACOES.filter(item => servicos.includes(item));
  }

  if (typeof valor === 'string') {
    try {
      return parseClienteSolicitouServicos(JSON.parse(valor));
    } catch {
      return parseClienteSolicitouServicos(valor.split(/\r?\n|[,;]/));
    }
  }

  return [];
}

function parseClienteSolicitouNumeros(valor) {
  const vazio = { bloqueio: [], cancelamento: [] };
  if (!valor) return vazio;

  if (typeof valor === 'string') {
    try {
      return parseClienteSolicitouNumeros(JSON.parse(valor));
    } catch {
      return vazio;
    }
  }

  if (typeof valor !== 'object') return vazio;

  return {
    bloqueio: parseNumerosPortados(valor.bloqueio).filter(numero => apenasDigitos(numero).length > 2),
    cancelamento: parseNumerosPortados(valor.cancelamento).filter(numero => apenasDigitos(numero).length > 2)
  };
}

function montarClienteSolicitouNumeros(numeros = {}) {
  return {
    bloqueio: (Array.isArray(numeros.bloqueio) ? numeros.bloqueio : parseNumerosPortados(numeros.bloqueio))
      .map(numero => String(numero || '').trim())
      .filter(numero => apenasDigitos(numero).length > 2),
    cancelamento: (Array.isArray(numeros.cancelamento) ? numeros.cancelamento : parseNumerosPortados(numeros.cancelamento))
      .map(numero => String(numero || '').trim())
      .filter(numero => apenasDigitos(numero).length > 2)
  };
}

function ajustarQuantidadeNumerosSolicitados(value, quantidade) {
  const total = Math.max(Number(quantidade || 0), 0);
  const atuais = Array.isArray(value) ? value : parseNumerosPortados(value);

  return Array.from({ length: total }, (_, index) => atuais[index] || NUMERO_PORTADO_VAZIO);
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
    numeros_ativados: parseNumerosAtivados(venda.numeros_ativados),
    cliente_solicitou_servicos: parseClienteSolicitouServicos(venda.cliente_solicitou_servicos),
    cliente_solicitou_bloqueio_qtd: venda.cliente_solicitou_bloqueio_qtd ?? '',
    cliente_solicitou_cancelamento_qtd: venda.cliente_solicitou_cancelamento_qtd ?? '',
    cliente_solicitou_numeros: parseClienteSolicitouNumeros(venda.cliente_solicitou_numeros),
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
    if (limite > 0) {
      const quantidadeItem = Number(itens[index]?.quantidade || 0);
      const totalSemEste = quantidadeTotal - quantidadeItem;
      if (totalSemEste < limite && itens.length <= 1) return;
    }
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
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              onClick={() => removerItem(index)}
              title="Remover item"
              disabled={limite > 0 && itens.length === 1 && quantidadeTotal <= limite}
            >
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
      {limite > 0 && quantidadeTotal < limite && (
        <div className="chip-items__aviso-minimo">
          Faltam {limite - quantidadeTotal} chip{limite - quantidadeTotal !== 1 ? 's' : ''} para atingir a quantidade de linhas contratadas
        </div>
      )}
    </div>
  );
}

function VendedorasSelect({ value = [], options = [], onChange, idProtegido = null }) {
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
    if (idProtegido !== null && String(id) === String(idProtegido)) return;
    onChange(value.filter(v => v !== String(id)));
  }

  return (
    <div className="vendedoras-select" ref={wrapperRef}>
      <div className="vendedoras-chips">
        {selecionadas.map(v => {
          const protegida = idProtegido !== null && String(v.id) === String(idProtegido);
          return (
            <span key={v.id} className="vendedoras-chip">
              {v.nome}
              {!protegida && (
                <button type="button" onClick={() => remover(v.id)} title="Remover">
                  <I.Close size={11} />
                </button>
              )}
            </span>
          );
        })}
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
      {numeros.map((numero, index) => {
        const naoVazio = !numeroLinhaTemApenasDddOuVazio(numero);
        const validacao = naoVazio ? validarNumeroTelefone(numero) : null;
        const invalido = validacao && !validacao.valido;

        return (
          <div key={index} className="ported-number-row">
            <div className="ported-number-input-wrap">
              <input
                type="text"
                inputMode="numeric"
                value={numero}
                onChange={event => atualizarNumero(index, formatarTelefoneComDdd(event.target.value, true))}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className={invalido ? 'is-invalid' : undefined}
                title={invalido ? validacao.motivo : undefined}
              />
              {invalido && <span className="field-hint field-hint--error">{validacao.motivo}</span>}
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => removerNumero(index)} title="Remover número">
              <I.Trash size={13} />
            </button>
          </div>
        );
      })}

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

function ClienteSolicitouInput({ form, onToggle, onOpenQuantidades }) {
  const servicos = parseClienteSolicitouServicos(form.cliente_solicitou_servicos);
  const nenhumSelecionado = servicos.includes('nenhum_servico');
  const selecionouAcao = CLIENTE_SOLICITOU_ACOES.some(acao => servicos.includes(acao));
  const numeros = parseClienteSolicitouNumeros(form.cliente_solicitou_numeros);
  const numerosBloqueioPreenchiodos = (numeros.bloqueio || []).filter(n => (n || '').replace(/\D/g, '').length > 2);
  const numerosCancelamentoPreeenchidos = (numeros.cancelamento || []).filter(n => (n || '').replace(/\D/g, '').length > 2);
  const totalNumeros = numerosBloqueioPreenchiodos.length + numerosCancelamentoPreeenchidos.length;

  return (
    <div className="cliente-solicitou">
      <div className="cliente-solicitou__options">
        {CLIENTE_SOLICITOU_OPCOES.map(opcao => {
          const marcado = servicos.includes(opcao.value);
          const disabled = nenhumSelecionado && opcao.value !== 'nenhum_servico';

          return (
            <label key={opcao.value} className={`cliente-solicitou-option ${marcado ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}>
              <input
                type="checkbox"
                checked={marcado}
                disabled={disabled}
                onChange={() => onToggle(opcao.value)}
              />
              <span>{opcao.label}</span>
            </label>
          );
        })}
      </div>

      {selecionouAcao && (
        <div className="cliente-solicitou__summary">
          <span>Bloqueio: <strong>{Number(form.cliente_solicitou_bloqueio_qtd || 0)}</strong></span>
          <span>Cancelamento: <strong>{Number(form.cliente_solicitou_cancelamento_qtd || 0)}</strong></span>
          <span>Números: <strong>{totalNumeros}</strong></span>
          <button type="button" className="btn btn-sm" onClick={onOpenQuantidades}>
            <I.Edit size={13} /> Quantificar
          </button>
        </div>
      )}

      {totalNumeros > 0 && (
        <div className="cliente-solicitou__numeros-preview">
          {numerosBloqueioPreenchiodos.length > 0 && (
            <div className="cliente-solicitou__numeros-grupo">
              <span className="cliente-solicitou__numeros-label cliente-solicitou__numeros-label--bloqueio">Bloqueio</span>
              {numerosBloqueioPreenchiodos.map((n, i) => {
                const invalido = !validarNumeroTelefone(n).valido;
                return (
                  <span key={i} title={invalido ? validarNumeroTelefone(n).motivo : undefined} className={`cliente-solicitou__numero-badge cliente-solicitou__numero-badge--bloqueio${invalido ? ' is-invalid-badge' : ''}`}>{n}</span>
                );
              })}
            </div>
          )}
          {numerosCancelamentoPreeenchidos.length > 0 && (
            <div className="cliente-solicitou__numeros-grupo">
              <span className="cliente-solicitou__numeros-label cliente-solicitou__numeros-label--cancelamento">Cancelamento</span>
              {numerosCancelamentoPreeenchidos.map((n, i) => {
                const invalido = !validarNumeroTelefone(n).valido;
                return (
                  <span key={i} title={invalido ? validarNumeroTelefone(n).motivo : undefined} className={`cliente-solicitou__numero-badge cliente-solicitou__numero-badge--cancelamento${invalido ? ' is-invalid-badge' : ''}`}>{n}</span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClienteSolicitouQuantidadeModal({ servicos, quantidades, onChange, onClose, onConfirm }) {
  const bloqueioSelecionado = servicos.includes('bloqueio');
  const cancelamentoSelecionado = servicos.includes('cancelamento');

  return (
    <div className="modal-overlay cliente-solicitou-quantidade-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal cliente-solicitou-quantidade-modal" role="dialog" aria-modal="true" aria-labelledby="cliente-solicitou-quantidade-title">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div id="cliente-solicitou-quantidade-title" className="modal-client">Quantificar chips</div>
              <div className="modal-sub">Informe quantos chips entram em cada operação.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} title="Fechar">
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="cliente-solicitou-quantidade-fields">
          {bloqueioSelecionado && (
            <label className="form-field">
              <span>Chips para bloqueio</span>
              <input type="number" min="1" inputMode="numeric" value={quantidades.bloqueio} onChange={event => onChange('bloqueio', apenasDigitos(event.target.value, 4))} placeholder="0" />
            </label>
          )}

          {cancelamentoSelecionado && (
            <label className="form-field">
              <span>Chips para cancelamento</span>
              <input type="number" min="1" inputMode="numeric" value={quantidades.cancelamento} onChange={event => onChange('cancelamento', apenasDigitos(event.target.value, 4))} placeholder="0" />
            </label>
          )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>Informar números</button>
        </div>
      </div>
    </div>
  );
}

function ClienteSolicitouNumerosModal({ servicos, quantidades, numeros, onChange, onClose, onConfirm }) {
  const selecionados = CLIENTE_SOLICITOU_ACOES.filter(acao => servicos.includes(acao));

  function atualizarNumero(tipo, index, valor) {
    onChange({
      ...numeros,
      [tipo]: (numeros[tipo] || []).map((numero, numeroIndex) => (
        numeroIndex === index ? formatarTelefoneComDdd(valor, true) : numero
      ))
    });
  }

  const faltando = selecionados.some(tipo => (
    (numeros[tipo] || []).filter(numero => apenasDigitos(numero).length > 2).length !== Number(quantidades[tipo] || 0)
  ));

  const digitosPreenchidos = selecionados.flatMap(tipo =>
    (numeros[tipo] || []).map(n => apenasDigitos(n)).filter(d => d.length > 2)
  );
  const contagemDigitos = digitosPreenchidos.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {});
  const digitosDuplicados = new Set(Object.keys(contagemDigitos).filter(d => contagemDigitos[d] > 1));

  return (
    <div className="modal-overlay">
      <div className="modal cliente-solicitou-numeros-modal">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">Números envolvidos</div>
              <div className="modal-sub">Preencha exatamente os números dos chips informados.</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} title="Fechar">
              <I.Close size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="cliente-solicitou-numeros">
            {selecionados.map(tipo => (
              <section key={tipo} className="cliente-solicitou-numeros__group">
                <div className="cliente-solicitou-numeros__title">
                  {tipo === 'bloqueio' ? 'Bloqueio' : 'Cancelamento'} ({Number(quantidades[tipo] || 0)})
                </div>
                {(numeros[tipo] || []).map((numero, index) => {
                  const digitos = apenasDigitos(numero);
                  const naoVazio = digitos.length > 2;
                  const validacao = naoVazio ? validarNumeroTelefone(numero) : null;
                  const invalido = validacao && !validacao.valido;
                  const duplicado = naoVazio && !invalido && digitosDuplicados.has(digitos);
                  const erro = invalido ? validacao.motivo : duplicado ? 'Número já adicionado' : null;
                  const classe = `cliente-solicitou-numero-row${invalido ? ' is-invalid' : duplicado ? ' is-duplicate' : ''}`;
                  return (
                    <label key={`${tipo}-${index}`} className={classe}>
                      <span>{index + 1}</span>
                      <div className="cs-numero-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={numero}
                          onChange={event => atualizarNumero(tipo, index, event.target.value)}
                          maxLength={15}
                          placeholder="(11) 99999-9999"
                        />
                        {erro && <span className="cs-numero-erro">{erro}</span>}
                      </div>
                    </label>
                  );
                })}
              </section>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Voltar</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={faltando || digitosDuplicados.size > 0}>
            Confirmar números
          </button>
        </div>
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

function ClienteVendaSelect({ value, clientes, vendasRegistradas = 0, vendasEmAndamento = 0, onChange, onCreateClient }) {
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
        <>
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
        {vendasEmAndamento > 0 && (
          <div className="venda-cliente-repeat-alert venda-cliente-repeat-alert--andamento">
            <I.AlertTriangle size={13} />
            <span>
              Este cliente possui {vendasEmAndamento} {vendasEmAndamento === 1 ? 'venda em andamento' : 'vendas em andamento'}.
            </span>
          </div>
        )}
        {vendasRegistradas - vendasEmAndamento > 0 && (
          <div className="venda-cliente-repeat-alert">
            <I.AlertTriangle size={13} />
            <span>
              {(() => { const n = vendasRegistradas - vendasEmAndamento; return `Este cliente possui ${n} ${n === 1 ? 'venda concluída' : 'vendas concluídas'}.`; })()}
            </span>
          </div>
        )}
        </>
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
        <strong>Venda ainda não salva</strong>
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

function getProblemaStatusLabel(status) {
  if (status === 'resolvido') return 'Aguardando verificacao';
  if (status === 'correcao_solicitada') return 'Correcao solicitada';
  return 'Problema aberto';
}

function getProblemaTitulo(problema) {
  const abertura = (problema.eventos || []).find(evento => evento.tipo === 'abertura');
  return abertura?.mensagem || `Problema #${problema.id}`;
}

function VendaProblemaCard({ problema, usuario, destacado, onAtualizar }) {
  const [mensagemResolucao, setMensagemResolucao] = useState('');
  const [mensagemCorrecao, setMensagemCorrecao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

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

      onAtualizar(problema.id, atualizado);
      window.dispatchEvent(new CustomEvent('pos-venda:notificacoes-atualizar'));
    } catch (error) {
      setErro(error.message || 'Erro ao atualizar problema da venda.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <article className={`venda-problema-card ${destacado ? 'is-highlighted' : ''}`} id={`problema-${problema.id}`}>
      <div className={`venda-problema-status status-${problema.status}`}>
        <strong>{getProblemaStatusLabel(problema.status)}</strong>
        <span>{getProblemaTitulo(problema)}</span>
        <em>Solicitado por {problema.solicitante?.nome || 'usuario'} em {formatarData(problema.aberto_em)}</em>
      </div>

      <div className="venda-problema-responsaveis">
        <strong>Responsaveis</strong>
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
          <label>Mensagem de resolucao</label>
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
          <label>Solicitar nova correcao</label>
          <AutoResizeTextarea value={mensagemCorrecao} onChange={event => setMensagemCorrecao(event.target.value)} placeholder="Descreva o que ainda precisa ser ajustado" />
          <button type="button" className="btn" disabled={salvando || !mensagemCorrecao.trim()} onClick={() => executar('correcao')}>
            Enviar correcao
          </button>
        </div>
      )}
    </article>
  );
}

function VendaProblemaPanel({ venda, usuario, initialProblemaId }) {
  const [problemas, setProblemas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar() {
    if (!venda?.id) return;

    setCarregando(true);
    setErro('');

    try {
      setProblemas(await listarProblemasVenda(venda.id));
    } catch (error) {
      setErro(error.message || 'Erro ao carregar problemas da venda.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venda?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!initialProblemaId || problemas.length === 0) return undefined;

    const timer = setTimeout(() => {
      document.getElementById(`problema-${initialProblemaId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);

    return () => clearTimeout(timer);
  }, [initialProblemaId, problemas.length]);

  function atualizarProblema(problemaId, atualizado) {
    setProblemas(prev => {
      if (atualizado?.status === 'verificado') {
        return prev.filter(item => Number(item.id) !== Number(problemaId));
      }

      return prev.map(item => Number(item.id) === Number(problemaId) ? atualizado : item);
    });
  }

  if (!venda?.id) {
    return <div className="venda-problema-empty">Salve a venda antes de acompanhar problemas.</div>;
  }

  if (carregando) {
    return <div className="venda-problema-empty">Carregando problemas da venda...</div>;
  }

  if (erro && problemas.length === 0) {
    return <div className="alert-error">{erro}</div>;
  }

  if (problemas.length === 0) {
    return <div className="venda-problema-empty">Nenhum problema ativo para esta venda.</div>;
  }

  return (
    <div className="venda-problema-panel">
      <div className="venda-problema-summary">
        <strong>{problemas.length} problema{problemas.length === 1 ? '' : 's'} ativo{problemas.length === 1 ? '' : 's'}</strong>
        <span>Cada problema possui responsaveis, historico e revisao independentes.</span>
      </div>

      {erro && <div className="alert-error">{erro}</div>}
      {problemas.map(problema => (
        <VendaProblemaCard
          key={problema.id}
          problema={problema}
          usuario={usuario}
          destacado={Number(problema.id) === Number(initialProblemaId)}
          onAtualizar={atualizarProblema}
        />
      ))}
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
  vendas = [],
  vendedoras,
  operadoras,
  tiposVenda,
  servicos,
  vendasPorCliente,
  vendasEmAndamentoPorCliente = new Map(),
  podeEditarVenda,
  podeVerDocumentosVenda,
  usuarioLogado,
  initialTab = 'venda',
  initialProblemaId = null,
  modoEdicao = true,
  onStartEdit,
  onClose,
  onSave,
  onSendToPosVenda,
  sendToPosVendaLabel = 'Enviar para o pós-venda',
  onCreateClient
}) {
  const [form, setForm] = useState(() => {
    const base = venda ? normalizarVenda(venda) : { ...VENDA_VAZIA, ...(initialValues || {}) };
    if (!venda && usuarioLogado?.id && vendedoras?.some(v => String(v.id) === String(usuarioLogado.id))) {
      const idStr = String(usuarioLogado.id);
      if (!base.vendedoras.includes(idStr)) base.vendedoras = [...base.vendedoras, idStr];
    }
    return base;
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [cepStatus, setCepStatus] = useState('');
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState({ tipo: '', mensagem: '' });
  const [cnpjDados, setCnpjDados] = useState(null);
  const [cnpjSugestoes, setCnpjSugestoes] = useState({});
  const [tipoBusca, setTipoBusca] = useState(() => sanitizarCpf(form.cnpj).length === 11 ? 'cpf' : 'cnpj');
  const [clienteSolicitouQuantidadeAberta, setClienteSolicitouQuantidadeAberta] = useState(false);
  const [clienteSolicitouNumerosAberto, setClienteSolicitouNumerosAberto] = useState(false);
  const [clienteSolicitouServicosDraft, setClienteSolicitouServicosDraft] = useState([]);
  const [clienteSolicitouQuantidadesDraft, setClienteSolicitouQuantidadesDraft] = useState({ bloqueio: '', cancelamento: '' });
  const [clienteSolicitouNumerosDraft, setClienteSolicitouNumerosDraft] = useState({ bloqueio: [], cancelamento: [] });
  const [enderecoRealModalAberto, setEnderecoRealModalAberto] = useState(false);
  const abaInicial = initialTab === 'arquivos' && !podeVerDocumentosVenda ? 'venda' : initialTab;
  const [abaAtiva, setAbaAtiva] = useState(abaInicial);
  const somenteVisualizacao = Boolean(venda) && !modoEdicao;
  const enviadaPosVenda = Boolean(venda?.enviada_pos_venda_em || form.enviada_pos_venda_em);
  const usuarioPosVenda = temPermissao(usuarioLogado, 'pos_venda');
  const usuarioAdmin = usuarioLogado?.role?.nome === 'admin';
  const vendaBloqueadaParaUsuario = enviadaPosVenda && !usuarioPosVenda;
  const ultimoCnpjConsultadoRef = useRef(venda ? sanitizarCnpj(form.cnpj) : '');
  const cepPreenchidoPorCnpjRef = useRef('');
  const vendaPortabilidade = temChipPortabilidade(form.valores_unitarios_chips);
  const quantidadePortabilidade = somarQuantidadePortabilidadeItensChips(form.valores_unitarios_chips || []);
  const vendaAtivada = Boolean(normalizarDataVendaInput(form.data_ativacao));
  const chaveClienteSelecionado = form.cliente_id ? `cliente:${form.cliente_id}` : '';
  const totalVendasClienteSelecionado = chaveClienteSelecionado ? (vendasPorCliente.get(chaveClienteSelecionado) || 0) : 0;
  const vendasRegistradasClienteSelecionado = venda?.id
    ? Math.max(totalVendasClienteSelecionado - 1, 0)
    : totalVendasClienteSelecionado;
  const totalEmAndamentoClienteSelecionado = chaveClienteSelecionado ? (vendasEmAndamentoPorCliente.get(chaveClienteSelecionado) || 0) : 0;
  const vendasEmAndamentoClienteSelecionado = venda?.id
    ? Math.max(totalEmAndamentoClienteSelecionado - 1, 0)
    : totalEmAndamentoClienteSelecionado;
  const quantidadeLinhasFechadas = Number(form.quantidade_linhas || 0);
  const quantidadeChipsVenda = somarQuantidadeItensChips(form.valores_unitarios_chips || []);
  const quantidadeNumerosAtivados = quantidadeChipsVenda || quantidadeLinhasFechadas;
  const clienteSolicitouServicos = parseClienteSolicitouServicos(form.cliente_solicitou_servicos);
  const clienteIdProtocolo = String(form.cliente_id || '');
  const vendaIdAtual = venda?.id ? String(venda.id) : '';
  const protocoloOriginal = String(venda?.protocolo || '').trim();
  const protocoloAtual = String(form.protocolo || '').trim();
  const vendaComProtocoloDoCliente = clienteIdProtocolo
    ? vendas.find(item => (
        String(item.id) !== vendaIdAtual
        && String(item.cliente_id || item.cliente?.id || '') === clienteIdProtocolo
        && String(item.protocolo || '').trim()
      ))
    : null;
  const clienteJaTemOutroProtocolo = Boolean(vendaComProtocoloDoCliente);
  const protocoloProtegido = Boolean(protocoloOriginal) && !usuarioAdmin;
  const protocoloBloqueado = somenteVisualizacao
    || vendaBloqueadaParaUsuario
    || clienteJaTemOutroProtocolo
    || !usuarioAdmin;
  const podeGerarProtocolo = !somenteVisualizacao
    && !vendaBloqueadaParaUsuario
    && !clienteJaTemOutroProtocolo
    && (!protocoloAtual || usuarioAdmin);
  const dicaProtocolo = clienteJaTemOutroProtocolo
    ? `Este cliente já possui protocolo: ${vendaComProtocoloDoCliente.protocolo}.`
    : protocoloProtegido
      ? 'Protocolo já gerado. Apenas ADM pode alterar ou apagar.'
      : !usuarioAdmin && protocoloAtual
        ? 'Protocolo gerado. Apenas ADM pode alterar ou apagar.'
        : '';

  function atualizarCampo(campo, valor) {
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

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
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

    const c = clientes.find(cliente => String(cliente.id) === String(valor));

    setForm(prev => {
      const telefoneWhatsapp = c ? formatarTelefoneComDdd([c.whatsapp_ddd, c.whatsapp_numero].filter(Boolean).join(''), true) : '';
      const telefoneFixo = c ? formatarTelefoneComDdd([c.fixo_ddd, c.fixo_numero].filter(Boolean).join(''), false) : '';
      const nomeRl = c?.responsavel_tipo === 'rl' ? (c.responsavel_nome || '') : '';
      const nomeAdm = c?.responsavel_tipo === 'adm' ? (c.responsavel_nome || '') : '';
      const fechouVenda = c?.responsavel_tipo === 'rl' ? 'RL' : c?.responsavel_tipo === 'adm' ? 'ADM' : '';

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
        nome_fechou_venda: prev.nome_fechou_venda || fechouVenda,
        operadora_atual_id: prev.operadora_atual_id || String(c?.operadora_atual_id || ''),
      };
    });
  }

  function atualizarVendedorasVenda(ids) {
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

    setForm(prev => ({ ...prev, vendedoras: ids }));
  }

  function alternarEnderecoReal(marcado) {
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

    setForm(prev => ({
      ...prev,
      endereco_real_divergente: marcado
    }));

    if (marcado) {
      setEnderecoRealModalAberto(true);
    }
  }

  function abrirClienteSolicitouQuantidades(servicos = clienteSolicitouServicos) {
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

    const selecionados = parseClienteSolicitouServicos(servicos).filter(servico => CLIENTE_SOLICITOU_ACOES.includes(servico));
    if (selecionados.length === 0) return;

    setClienteSolicitouServicosDraft(selecionados);
    setClienteSolicitouQuantidadesDraft({
      bloqueio: selecionados.includes('bloqueio') ? String(form.cliente_solicitou_bloqueio_qtd || '') : '',
      cancelamento: selecionados.includes('cancelamento') ? String(form.cliente_solicitou_cancelamento_qtd || '') : ''
    });
    setClienteSolicitouQuantidadeAberta(true);
  }

  function alternarClienteSolicitouServico(servico) {
    if (somenteVisualizacao || vendaBloqueadaParaUsuario) return;

    setForm(prev => {
      const atuais = parseClienteSolicitouServicos(prev.cliente_solicitou_servicos);

      if (servico === 'nenhum_servico') {
        const selecionado = atuais.includes('nenhum_servico');
        return {
          ...prev,
          cliente_solicitou_servicos: selecionado ? [] : ['nenhum_servico'],
          cliente_solicitou_bloqueio_qtd: '',
          cliente_solicitou_cancelamento_qtd: '',
          cliente_solicitou_numeros: { bloqueio: [], cancelamento: [] }
        };
      }

      const semNenhum = atuais.filter(item => item !== 'nenhum_servico');
      const proximos = semNenhum.includes(servico)
        ? semNenhum.filter(item => item !== servico)
        : [...semNenhum, servico];
      const numerosAtuais = parseClienteSolicitouNumeros(prev.cliente_solicitou_numeros);

      return {
        ...prev,
        cliente_solicitou_servicos: proximos,
        cliente_solicitou_bloqueio_qtd: proximos.includes('bloqueio') ? prev.cliente_solicitou_bloqueio_qtd : '',
        cliente_solicitou_cancelamento_qtd: proximos.includes('cancelamento') ? prev.cliente_solicitou_cancelamento_qtd : '',
        cliente_solicitou_numeros: {
          bloqueio: proximos.includes('bloqueio') ? numerosAtuais.bloqueio : [],
          cancelamento: proximos.includes('cancelamento') ? numerosAtuais.cancelamento : []
        }
      };
    });
  }

  function confirmarClienteSolicitouQuantidades() {
    const selecionados = parseClienteSolicitouServicos(clienteSolicitouServicosDraft);
    const bloqueioQtd = selecionados.includes('bloqueio') ? Number(clienteSolicitouQuantidadesDraft.bloqueio || 0) : 0;
    const cancelamentoQtd = selecionados.includes('cancelamento') ? Number(clienteSolicitouQuantidadesDraft.cancelamento || 0) : 0;

    if (selecionados.includes('bloqueio') && bloqueioQtd <= 0) {
      setErro('Informe a quantidade de chips para bloqueio.');
      return;
    }

    if (selecionados.includes('cancelamento') && cancelamentoQtd <= 0) {
      setErro('Informe a quantidade de chips para cancelamento.');
      return;
    }

    const numerosAtuais = parseClienteSolicitouNumeros(form.cliente_solicitou_numeros);
    const numerosAjustados = {
      bloqueio: selecionados.includes('bloqueio')
        ? ajustarQuantidadeNumerosSolicitados(numerosAtuais.bloqueio, bloqueioQtd)
        : [],
      cancelamento: selecionados.includes('cancelamento')
        ? ajustarQuantidadeNumerosSolicitados(numerosAtuais.cancelamento, cancelamentoQtd)
        : []
    };

    setForm(prev => ({
      ...prev,
      cliente_solicitou_bloqueio_qtd: bloqueioQtd ? String(bloqueioQtd) : '',
      cliente_solicitou_cancelamento_qtd: cancelamentoQtd ? String(cancelamentoQtd) : '',
      cliente_solicitou_numeros: numerosAjustados
    }));
    setClienteSolicitouNumerosDraft(numerosAjustados);
    setClienteSolicitouQuantidadeAberta(false);
    setClienteSolicitouNumerosAberto(true);
  }

  function confirmarClienteSolicitouNumeros() {
    const numeros = montarClienteSolicitouNumeros(clienteSolicitouNumerosDraft);
    const bloqueioQtd = Number(form.cliente_solicitou_bloqueio_qtd || clienteSolicitouQuantidadesDraft.bloqueio || 0);
    const cancelamentoQtd = Number(form.cliente_solicitou_cancelamento_qtd || clienteSolicitouQuantidadesDraft.cancelamento || 0);

    if (clienteSolicitouServicosDraft.includes('bloqueio') && numeros.bloqueio.length !== bloqueioQtd) return;
    if (clienteSolicitouServicosDraft.includes('cancelamento') && numeros.cancelamento.length !== cancelamentoQtd) return;

    setForm(prev => ({ ...prev, cliente_solicitou_numeros: numeros }));
    setClienteSolicitouNumerosAberto(false);
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

  function recusarSugestaoCnpj(campoApi) {
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

  function alterarTipoBusca(tipo) {
    setTipoBusca(tipo);
    setForm(prev => ({ ...prev, cnpj: '' }));
    setCnpjStatus({ tipo: '', mensagem: '' });
    setCnpjDados(null);
    setCnpjSugestoes({});
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
    if (tipoBusca !== 'cnpj') return;

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

    if (somenteVisualizacao || vendaBloqueadaParaUsuario) {
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

      if (protocoloProtegido && protocoloAtual !== protocoloOriginal) {
        setErro('Apenas ADM pode alterar ou apagar o protocolo do cliente.');
        setSalvando(false);
        return;
      }

      if (clienteJaTemOutroProtocolo && protocoloAtual) {
        setErro('Este cliente já possui um protocolo cadastrado em outra venda.');
        setSalvando(false);
        return;
      }

      if (tipoBusca === 'cnpj') {
        const cnpjDigitos = sanitizarCnpj(form.cnpj);
        if (cnpjDigitos.length > 0 && cnpjDigitos.length < 14) {
          setErro('CNPJ incompleto.');
          setSalvando(false);
          return;
        }
        if (cnpjDigitos.length === 14 && !validarDigitosCnpj(cnpjDigitos)) {
          setErro('CNPJ inválido.');
          setSalvando(false);
          return;
        }
      } else {
        const cpfDigitos = sanitizarCpf(form.cnpj);
        if (cpfDigitos.length > 0 && cpfDigitos.length < 11) {
          setErro('CPF incompleto.');
          setSalvando(false);
          return;
        }
        if (cpfDigitos.length === 11 && !validarDigitosCpf(cpfDigitos)) {
          setErro('CPF inválido.');
          setSalvando(false);
          return;
        }
      }

      const numerosPortados = montarNumerosPortados(form.numeros_portados);
      const numerosAtivados = montarNumerosAtivados(form.numeros_ativados);
      const quantidadeChips = somarQuantidadeItensChips(form.valores_unitarios_chips || []);

      if (quantidadeLinhasFechadas > 0 && quantidadeChips > quantidadeLinhasFechadas) {
        setErro('A quantidade de chips não pode ser maior que a quantidade de linhas fechadas.');
        setSalvando(false);
        return;
      }

      if (quantidadeLinhasFechadas > 0 && quantidadeChips < quantidadeLinhasFechadas) {
        setErro(`A quantidade de chips (${quantidadeChips}) é menor que a quantidade de linhas contratadas (${quantidadeLinhasFechadas}).`);
        setSalvando(false);
        return;
      }

      if (vendaPortabilidade && !numerosPortados) {
        setErro('Informe pelo menos um número a ser portado.');
        setSalvando(false);
        return;
      }

      const servicosSolicitados = parseClienteSolicitouServicos(form.cliente_solicitou_servicos);

      if (servicosSolicitados.length === 0) {
        setErro('Informe o que o cliente solicitou (Bloqueio, Cancelamento ou Nenhum serviço).');
        setSalvando(false);
        return;
      }
      const solicitouNenhumServico = servicosSolicitados.includes('nenhum_servico');
      const solicitouBloqueio = servicosSolicitados.includes('bloqueio');
      const solicitouCancelamento = servicosSolicitados.includes('cancelamento');
      const bloqueioQtd = solicitouBloqueio ? Number(form.cliente_solicitou_bloqueio_qtd || 0) : 0;
      const cancelamentoQtd = solicitouCancelamento ? Number(form.cliente_solicitou_cancelamento_qtd || 0) : 0;
      const numerosSolicitados = montarClienteSolicitouNumeros(form.cliente_solicitou_numeros);

      if (solicitouBloqueio && bloqueioQtd <= 0) {
        setErro('Informe a quantidade de chips para bloqueio.');
        setSalvando(false);
        return;
      }

      if (solicitouCancelamento && cancelamentoQtd <= 0) {
        setErro('Informe a quantidade de chips para cancelamento.');
        setSalvando(false);
        return;
      }

      if (solicitouBloqueio && numerosSolicitados.bloqueio.length !== bloqueioQtd) {
        setErro('Preencha exatamente a quantidade de números de bloqueio informada.');
        setSalvando(false);
        return;
      }

      if (solicitouCancelamento && numerosSolicitados.cancelamento.length !== cancelamentoQtd) {
        setErro('Preencha exatamente a quantidade de números de cancelamento informada.');
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
        cliente_solicitou_servicos: solicitouNenhumServico ? ['nenhum_servico'] : servicosSolicitados,
        cliente_solicitou_bloqueio_qtd: solicitouNenhumServico || !solicitouBloqueio ? null : bloqueioQtd,
        cliente_solicitou_cancelamento_qtd: solicitouNenhumServico || !solicitouCancelamento ? null : cancelamentoQtd,
        cliente_solicitou_numeros: solicitouNenhumServico ? { bloqueio: [], cancelamento: [] } : {
          bloqueio: solicitouBloqueio ? numerosSolicitados.bloqueio : [],
          cancelamento: solicitouCancelamento ? numerosSolicitados.cancelamento : []
        },
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

  async function handleEnviarPosVenda() {
    if (!venda?.id || salvando || enviadaPosVenda) return;

    setErro('');
    setSalvando(true);

    try {
      await onSendToPosVenda(venda);
    } catch (error) {
      setErro(error.message || 'Erro ao enviar venda para o pós-venda.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal venda-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{venda ? ((somenteVisualizacao || vendaBloqueadaParaUsuario) ? 'Visualizar venda' : 'Editar venda') : 'Nova venda'}</div>
              <div className="modal-sub">
                {vendaBloqueadaParaUsuario
                  ? 'Venda enviada ao pós-venda. Apenas a equipe de pós-venda pode editar.'
                  : somenteVisualizacao
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
            <VendaProblemaPanel venda={venda} usuario={usuarioLogado} initialProblemaId={initialProblemaId} />
          ) : (
          <>
            {enviadaPosVenda && (
              <div className="venda-pos-venda-banner">
                <I.Check size={14} />
                <span>Enviada para o pós-venda</span>
              </div>
            )}
            <fieldset className="venda-readonly-fieldset" disabled={somenteVisualizacao || vendaBloqueadaParaUsuario}>
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
              const erroCpfCampo = obterErroCpfCampo(campo.name, form[campo.name]);
              const hintCpfId = erroCpfCampo ? `venda-${campo.name}-erro` : undefined;

              return (
                <div key={campo.name} className={`form-field ${campo.span ? 'span-2' : ''} ${erroCpfCampo ? 'is-invalid' : ''}`}>
                  {labelCampo && <label>{labelCampo}{campo.required && <span className="field-required-mark"> *</span>}</label>}
                  {campo.type === 'client' ? (
                      <ClienteVendaSelect
                        value={form[campo.name] ?? ''}
                        clientes={clientes}
                        vendasRegistradas={vendasRegistradasClienteSelecionado}
                        vendasEmAndamento={vendasEmAndamentoClienteSelecionado}
                        onChange={atualizarClienteVenda}
                        onCreateClient={async () => {
                          const clienteCriado = await onCreateClient?.();
                          if (clienteCriado?.id) {
                            atualizarClienteVenda(String(clienteCriado.id));
                          }
                        }}
                      />
                  ) : campo.type === 'cnpj' ? (
                    <>
                      <div className="doc-tipo-toggle">
                        <button type="button" className={`btn btn-sm${tipoBusca === 'cnpj' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => alterarTipoBusca('cnpj')}>CNPJ</button>
                        <button type="button" className={`btn btn-sm${tipoBusca === 'cpf' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => alterarTipoBusca('cpf')}>CPF</button>
                      </div>
                      {tipoBusca === 'cnpj' ? (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={18}
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
                            onRecusar={recusarSugestaoCnpj}
                          />
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={14}
                            value={form[campo.name] ?? ''}
                            onChange={e => atualizarCampo(campo.name, formatarCpf(e.target.value))}
                            placeholder="000.000.000-00"
                          />
                          {(() => {
                            const digitos = sanitizarCpf(form[campo.name] || '');
                            if (digitos.length > 0 && digitos.length < 11) return <span className="field-hint field-hint--error">CPF incompleto</span>;
                            if (digitos.length === 11 && !validarDigitosCpf(digitos)) return <span className="field-hint field-hint--error">CPF inválido</span>;
                            return null;
                          })()}
                        </>
                      )}
                    </>
                  ) : campo.type === 'sellers' ? (
                    <VendedorasSelect
                      value={form.vendedoras || []}
                      options={vendedoras}
                      onChange={atualizarVendedorasVenda}
                      idProtegido={vendedoras?.some(v => String(v.id) === String(usuarioLogado?.id)) ? usuarioLogado?.id : null}
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
                  ) : campo.type === 'closedWith' ? (
                    <select
                      value={FECHOU_VENDA_OPCOES.some(opcao => opcao.value === form[campo.name]) ? form[campo.name] : ''}
                      onChange={e => atualizarCampo(campo.name, e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FECHOU_VENDA_OPCOES.map(opcao => (
                        <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                      ))}
                    </select>
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
                  ) : campo.type === 'clientRequested' ? (
                    <ClienteSolicitouInput
                      form={form}
                      onToggle={alternarClienteSolicitouServico}
                      onOpenQuantidades={() => abrirClienteSolicitouQuantidades()}
                    />
                  ) : campo.type === 'realAddressToggle' ? (
                    <div className="venda-address-toggle">
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(form.endereco_real_divergente)}
                          onChange={e => alternarEnderecoReal(e.target.checked)}
                          disabled={somenteVisualizacao || vendaBloqueadaParaUsuario}
                        />
                        <span>{campo.label}</span>
                      </label>
                      {form.endereco_real_divergente && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setEnderecoRealModalAberto(true)}
                        >
                          Editar endereço real
                        </button>
                      )}
                    </div>
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
                    <>
                      <div className="protocolo-input-row">
                        <input
                          type="text"
                          value={form[campo.name] ?? ''}
                          onChange={e => atualizarCampo(campo.name, e.target.value)}
                          readOnly={protocoloBloqueado}
                        />
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => atualizarCampo('protocolo', gerarProtocoloDataHora())}
                          disabled={!podeGerarProtocolo}
                        >
                          Gerar
                        </button>
                      </div>
                      {dicaProtocolo && <span className="field-hint">{dicaProtocolo}</span>}
                    </>
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
                      placeholder={campo.placeholder}
                      required={campo.required}
                      aria-invalid={erroCpfCampo ? 'true' : undefined}
                      aria-describedby={hintCpfId}
                    />
                  )}
                  {erroCpfCampo && (
                    <span id={hintCpfId} className="field-hint field-hint--error">{erroCpfCampo}</span>
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

        {clienteSolicitouQuantidadeAberta && (
          <ClienteSolicitouQuantidadeModal
            servicos={clienteSolicitouServicosDraft}
            quantidades={clienteSolicitouQuantidadesDraft}
            onChange={(tipo, valor) => setClienteSolicitouQuantidadesDraft(prev => ({ ...prev, [tipo]: valor }))}
            onClose={() => setClienteSolicitouQuantidadeAberta(false)}
            onConfirm={confirmarClienteSolicitouQuantidades}
          />
        )}

        {clienteSolicitouNumerosAberto && (
          <ClienteSolicitouNumerosModal
            servicos={clienteSolicitouServicosDraft}
            quantidades={{
              bloqueio: form.cliente_solicitou_bloqueio_qtd || clienteSolicitouQuantidadesDraft.bloqueio,
              cancelamento: form.cliente_solicitou_cancelamento_qtd || clienteSolicitouQuantidadesDraft.cancelamento
            }}
            numeros={clienteSolicitouNumerosDraft}
            onChange={setClienteSolicitouNumerosDraft}
            onClose={() => {
              setClienteSolicitouNumerosAberto(false);
              setClienteSolicitouQuantidadeAberta(true);
            }}
            onConfirm={confirmarClienteSolicitouNumeros}
          />
        )}

        {enderecoRealModalAberto && (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={event => event.target === event.currentTarget && setEnderecoRealModalAberto(false)}>
            <div className="modal venda-address-modal">
              <div className="modal-header">
                <div className="modal-header-row">
                  <div>
                    <div className="modal-client">Endereço real</div>
                    <div className="modal-sub">Fica salvo na venda sem substituir o endereço da Receita.</div>
                  </div>
                  <button
                    className="btn btn-icon btn-ghost"
                    type="button"
                    onClick={() => setEnderecoRealModalAberto(false)}
                    title="Fechar"
                  >
                    <I.Close />
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div className="vendas-form-grid venda-address-modal__grid">
                  {CAMPOS_ENDERECO_REAL_VENDA.map(campo => (
                    <div key={campo.name} className={`form-field ${campo.span ? 'span-2' : ''}`}>
                      <label>{campo.label}</label>
                      {campo.type === 'longText' ? (
                        <AutoResizeTextarea
                          value={form[campo.name] ?? ''}
                          onChange={e => atualizarCampo(campo.name, e.target.value)}
                          maxRows={3}
                          disabled={somenteVisualizacao || vendaBloqueadaParaUsuario}
                        />
                      ) : (
                        <input
                          value={form[campo.name] ?? ''}
                          onChange={e => atualizarCampo(campo.name, e.target.value)}
                          maxLength={getMaxLengthCampo(campo.name, campo.maxLength)}
                          inputMode={getInputModeCampo(campo.name)}
                          disabled={somenteVisualizacao || vendaBloqueadaParaUsuario}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-primary" type="button" onClick={() => setEnderecoRealModalAberto(false)}>
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {abaAtiva === 'notas' || abaAtiva === 'arquivos' || abaAtiva === 'problema' ? (
            <button type="button" className="btn" onClick={onClose}>Fechar</button>
          ) : (somenteVisualizacao || vendaBloqueadaParaUsuario) ? (
            <>
              <button type="button" className="btn" onClick={onClose}>Fechar</button>
              {podeEditarVenda && !enviadaPosVenda && (
                <button type="button" className="btn venda-pos-venda-send-btn" disabled={salvando} onClick={handleEnviarPosVenda}>
                  <I.ArrowRight size={14} /> {salvando ? 'Aguarde...' : sendToPosVendaLabel}
                </button>
              )}
              {podeEditarVenda && !vendaBloqueadaParaUsuario && (
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


export default VendaModal;
