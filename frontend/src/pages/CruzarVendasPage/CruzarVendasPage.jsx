import { useEffect, useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarOperadoras } from '../../services/config.service';
import { previewCruzamento, processarCruzamento } from '../../services/venda-cruzamento.service';
import './CruzarVendasPage.css';

const OPCOES_TIPO = ['Novo', 'Base'];
const PASSOS = [
  { id: 'upload', rotulo: 'Enviar planilhas' },
  { id: 'abas', rotulo: 'Classificar abas' },
  { id: 'colunas', rotulo: 'Configurar colunas' },
  { id: 'resultado', rotulo: 'Colunas do resultado' }
];
const TIPOS_ABA = [
  { valor: 'INTERNAL_SALES', rotulo: 'Vendas internas' },
  { valor: 'CLARO_MONTHLY_CLOSING', rotulo: 'Fechamento mensal Claro' },
  { valor: 'VIVO_DETAILED', rotulo: 'Vivo — detalhada' },
  { valor: 'VIVO_MIRROR', rotulo: 'Vivo — espelho/resumo' },
  { valor: 'VIVO_PF', rotulo: 'Vivo — pessoa física' },
  { valor: 'OTHER_CONFIRMATION', rotulo: 'Outra planilha de confirmação' },
  { valor: 'IGNORE', rotulo: 'Ignorar' }
];
const TIPOS_ABA_VISIVEIS = TIPOS_ABA
  .filter(tipo => tipo.valor !== 'VIVO_MIRROR')
  .map(tipo => {
    if (tipo.valor === 'CLARO_MONTHLY_CLOSING') return { ...tipo, rotulo: 'Claro - vendas detalhadas' };
    if (tipo.valor === 'VIVO_DETAILED') return { ...tipo, rotulo: 'Vivo - vendas detalhadas' };
    return tipo;
  });

function sugerirTipoAba(nome, arquivoIndex, nomeArquivo = '') {
  const textoArquivo = String(nomeArquivo).toLowerCase();
  const texto = `${textoArquivo} ${String(nome).toLowerCase()}`;
  if (arquivoIndex === 0) return 'INTERNAL_SALES';
  if (textoArquivo.includes('claro')) return 'CLARO_MONTHLY_CLOSING';
  if (textoArquivo.includes('vivo')) return texto.includes('pf') ? 'VIVO_PF' : 'VIVO_DETAILED';
  if (texto.includes('pf')) return 'VIVO_PF';
  if (texto.includes('fevereiro') || texto.includes('abril')) return 'VIVO_DETAILED';
  if (texto.includes('mar') || texto.includes('maio')) return 'VIVO_DETAILED';
  if (texto.includes('março') || texto.includes('marco') || texto.includes('maio')) return 'VIVO_MIRROR';
  return 'OTHER_CONFIRMATION';
}

/**
 * Sugere Novo/Base a partir do texto do valor de Tipo de origem.
 */
function sugerirTipo(valor) {
  const texto = String(valor || '').toLowerCase();
  if (texto.includes('novo') || texto.includes('fresh')) return 'Novo';
  if (texto.includes('incremento') || texto.includes('base')) return 'Base';
  return '';
}

/**
 * Monta um tipoMap inicial a partir dos valores distintos da coluna escolhida.
 */
function montarTipoMapInicial(valores = []) {
  return valores.reduce((mapa, valor) => ({ ...mapa, [valor]: sugerirTipo(valor) }), {});
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function indiceColuna(colunas = [], nomeColuna) {
  return colunas.find(coluna => coluna.nome === nomeColuna)?.index || '';
}

function aplicarIndice(config, colunas = [], campo) {
  return {
    ...config,
    [`${campo}Index`]: indiceColuna(colunas, config?.[campo])
  };
}

function atualizarCampoMapeamento(config, campo, valor, coluna) {
  return {
    ...config,
    [campo]: valor,
    [`${campo}Index`]: coluna?.index || ''
  };
}

function colunaBaseFresh(colunas = []) {
  return colunas.find(coluna => normalizarTexto(coluna.nome) === 'base/fresh') || null;
}

/**
 * Sugere a coluna de quantidade (chips) da planilha principal.
 */
function colunaQuantidade(colunas = []) {
  return colunas.find(coluna => /quantidade|qtd|chips/i.test(coluna.nome)) || null;
}

/**
 * Sugere as colunas de contas/chips a somar numa planilha de operadora (ex.: Claro "Ctns ...").
 * Vazio quando nao ha (ex.: Vivo, 1 chip por linha).
 */
function colunasDeChips(colunas = []) {
  return colunas.filter(coluna => /\bctns\b|contas|chips/i.test(coluna.nome)).map(coluna => coluna.nome);
}

/**
 * Sugere a coluna de valor unitario (por chip) da planilha principal.
 */
function colunaValor(colunas = []) {
  return colunas.find(coluna => {
    const nome = normalizarTexto(coluna.nome);
    return nome === 'valor' || nome.includes('valor da venda') || nome.includes('mensalidade');
  }) || null;
}

/**
 * Sugere as colunas de valor a somar numa planilha de operadora, cujo total e o valor pago
 * na linha (ex.: Claro "Receita Nova/Incrementada/Renovada"; Vivo "VALOR").
 */
function colunasDeValor(colunas = []) {
  return colunas
    .filter(coluna => {
      const nome = normalizarTexto(coluna.nome);
      return nome === 'valor' || /receita (nova|incrementada|renovada)/.test(nome) || nome.includes('valor da venda');
    })
    .map(coluna => coluna.nome);
}

function operadoraPorNomeArquivo(nomeArquivo, operadoras = []) {
  const texto = normalizarTexto(nomeArquivo);
  const alvo = texto.includes('vivo') ? 'vivo' : texto.includes('claro') ? 'claro' : '';
  if (!alvo) return '';
  return operadoras.find(operadora => normalizarTexto(operadora.nome) === alvo)?.nome || (alvo === 'vivo' ? 'Vivo' : 'Claro');
}

function rotuloArquivo(item) {
  if (!item) return '';
  return item.arquivoIndex === 0 ? `${item.arquivo} (Principal)` : item.arquivo;
}

function chaveAba(arquivoIndex, aba) {
  return `${arquivoIndex}::${aba}`;
}

function semAbas(config = {}) {
  const resto = { ...(config || {}) };
  delete resto.abas;
  return resto;
}

function sugerirPrincipalAba(aba, sugestaoGeral = {}) {
  return {
    cnpj: sugestaoGeral.cnpj || '',
    razaoSocial: sugestaoGeral.razaoSocial || '',
    operadora: sugestaoGeral.operadora || '',
    data: sugestaoGeral.data || '',
    valor: sugestaoGeral.valor || '',
    ...(aba?.colunas ? {
      cnpj: aba.colunas.find(coluna => /cnpj|cpf\/cnpj|cnpj\/cpf/i.test(coluna.nome))?.nome || sugestaoGeral.cnpj || '',
      razaoSocial: aba.colunas.find(coluna => /razao|razão|empresa|cliente/i.test(coluna.nome))?.nome || sugestaoGeral.razaoSocial || '',
      operadora: aba.colunas.find(coluna => /operadora/i.test(coluna.nome))?.nome || sugestaoGeral.operadora || '',
      data: aba.colunas.find(coluna => /data da venda|data/i.test(coluna.nome))?.nome || sugestaoGeral.data || '',
      valor: colunaValor(aba.colunas)?.nome || sugestaoGeral.valor || ''
    } : {})
  };
}

function sugerirOperadoraAba(aba, sugestaoGeral = {}) {
  const tipo = aba?.colunas?.find(coluna => /base\/fresh|base|tipo/i.test(coluna.nome))?.nome || sugestaoGeral.tipo || '';
  return {
    cnpj: aba?.colunas?.find(coluna => /cnpj/i.test(coluna.nome))?.nome || sugestaoGeral.cnpj || '',
    cpf: aba?.colunas?.find(coluna => /^cpf$|cpf\/cnpj|cnpj\/cpf/i.test(coluna.nome))?.nome || sugestaoGeral.cpf || '',
    razaoSocial: aba?.colunas?.find(coluna => /razao|razão|empresa|cliente/i.test(coluna.nome))?.nome || sugestaoGeral.razaoSocial || '',
    tipo,
    valorOperadora: '',
    tipoMap: montarTipoMapInicial(aba?.valoresDistintos?.[tipo] || []),
    valorColunas: colunasDeValor(aba?.colunas || [])
  };
}

/**
 * Campo de seleção de coluna com amostras ao lado.
 */
function SelectColuna({ label, obrigatorio, valor, colunas, amostras, onChange }) {
  const exemplos = (amostras || [])
    .map(item => item.dados?.[valor])
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');

  return (
    <div className="cruzar-map__row">
      <label>
        {label}
        {obrigatorio && <span className="required-mark">*</span>}
      </label>
      <select value={valor || ''} onChange={event => onChange(event.target.value, colunas.find(coluna => coluna.nome === event.target.value))} required={obrigatorio}>
        <option value="">Selecione…</option>
        {colunas.map(coluna => (
          <option key={`${coluna.index}-${coluna.nome}`} value={coluna.nome}>{coluna.nome}</option>
        ))}
      </select>
      <span title={exemplos}>{exemplos || '-'}</span>
    </div>
  );
}

/**
 * Bloco de mapeamento de uma operadora (CPF, Tipo, identificador e mapa de valores).
 */
function BlocoOperadora({ titulo, preview, config, onConfig, operadoras = [], mostrarIdentificador = true }) {
  const colunas = preview?.colunas || [];
  const valoresTipo = config.tipo ? (preview?.valoresDistintos?.[config.tipo] || []) : [];

  /**
   * Atualiza a coluna de Tipo e reinicializa o mapa de valores.
   */
  function alterarColunaTipo(valor, coluna) {
    const valores = preview?.valoresDistintos?.[valor] || [];
    onConfig({ ...atualizarCampoMapeamento(config, 'tipo', valor, coluna), tipoMap: montarTipoMapInicial(valores) });
  }

  return (
    <div className="cruzar-card">
      <div className="cruzar-card__title">
        {titulo}
        <small className="cruzar-card__meta">{preview?.abas || 0} aba(s) · {preview?.total_linhas || 0} linha(s) lidas</small>
      </div>
      <div className="cruzar-map">
        <SelectColuna
          label="Coluna CNPJ"
          valor={config.cnpj}
          colunas={colunas}
          amostras={preview?.amostras}
          onChange={(valor, coluna) => onConfig(atualizarCampoMapeamento(config, 'cnpj', valor, coluna))}
        />
        <SelectColuna
          label="Coluna CPF"
          valor={config.cpf}
          colunas={colunas}
          amostras={preview?.amostras}
          onChange={(valor, coluna) => onConfig(atualizarCampoMapeamento(config, 'cpf', valor, coluna))}
        />
        <SelectColuna
          label="Coluna Razão Social (fallback)"
          valor={config.razaoSocial}
          colunas={colunas}
          amostras={preview?.amostras}
          onChange={(valor, coluna) => onConfig(atualizarCampoMapeamento(config, 'razaoSocial', valor, coluna))}
        />
        <SelectColuna
          label="Coluna Tipo"
          obrigatorio
          valor={config.tipo}
          colunas={colunas}
          amostras={preview?.amostras}
          onChange={alterarColunaTipo}
        />
        <div className="cruzar-map__row">
          <label>Colunas de chips (somar)</label>
          <select
            multiple
            value={config.quantidadeColunas || []}
            onChange={event => onConfig({ ...config, quantidadeColunas: Array.from(event.target.selectedOptions, opcao => opcao.value) })}
          >
            {colunas.map(coluna => (
              <option key={`${coluna.index}-chips`} value={coluna.nome}>{coluna.nome}</option>
            ))}
          </select>
          <span>Some as colunas de contas (ex.: Claro “Ctns …”). Vazio = 1 chip por linha (ex.: Vivo).</span>
        </div>
        <div className="cruzar-map__row">
          <label>Colunas de valor (somar)</label>
          <select
            multiple
            value={config.valorColunas || []}
            onChange={event => onConfig({ ...config, valorColunas: Array.from(event.target.selectedOptions, opcao => opcao.value) })}
          >
            {colunas.map(coluna => (
              <option key={`${coluna.index}-valor`} value={coluna.nome}>{coluna.nome}</option>
            ))}
          </select>
          <span>Total pago na linha (ex.: Claro “Receita …”; Vivo “VALOR”). Usado para conferir os valores dos chips.</span>
        </div>
        {mostrarIdentificador && <div className="cruzar-map__row">
          <label>Operadora</label>
          <select
            value={config.valorOperadora || ''}
            onChange={event => onConfig({ ...config, valorOperadora: event.target.value })}
          >
            <option value="">Selecione...</option>
            {operadoras.map(operadora => (
              <option key={operadora.id || operadora.nome} value={operadora.nome}>{operadora.nome}</option>
            ))}
          </select>
          <span>Usada para comparar com a coluna de operadora da principal</span>
        </div>}
      </div>

      {config.tipo && (
        <div className="cruzar-tipo-map">
          <div className="cruzar-tipo-map__head">Como classificar cada valor de “{config.tipo}”</div>
          {valoresTipo.length === 0 && <div className="cruzar-empty">Nenhum valor encontrado nesta coluna.</div>}
          <div className="cruzar-tipo-map__grid">
            {valoresTipo.map(valor => (
              <label key={valor} className="cruzar-tipo-map__item">
                <span title={valor}>{valor}</span>
                <select
                  value={config.tipoMap?.[valor] || ''}
                  onChange={event => onConfig({
                    ...config,
                    tipoMap: { ...config.tipoMap, [valor]: event.target.value }
                  })}
                >
                  <option value="">Manter original</option>
                  {OPCOES_TIPO.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Página de cruzamento de vendas: upload de várias planilhas, mapeamento configurável e download.
 */
function CruzarVendasPage() {
  const [arquivos, setArquivos] = useState([]);
  const [principalIndex, setPrincipalIndex] = useState(0);
  const [preview, setPreview] = useState(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [operadorasBanco, setOperadorasBanco] = useState([]);

  const [principalCfg, setPrincipalCfg] = useState({ cnpj: '', razaoSocial: '', operadora: '', data: '', valor: '' });
  const [operadorasCfg, setOperadorasCfg] = useState([]);
  const [selecoesAbas, setSelecoesAbas] = useState([]);
  const [abaConfigAtiva, setAbaConfigAtiva] = useState('');
  const [colunasResultado, setColunasResultado] = useState([]);
  const [passoAtual, setPassoAtual] = useState(0);

  const todosArquivos = arquivos.length >= 2;
  const abaEstaConfigurada = selecao => {
    if (!selecao?.usar) return true;
    if (selecao.arquivoIndex === 0) {
      const config = { ...semAbas(principalCfg), ...(principalCfg.abas?.[selecao.aba] || {}) };
      return Boolean(config.cnpj && config.operadora);
    }
    const configArquivo = operadorasCfg[selecao.arquivoIndex - 1] || {};
    const config = { ...semAbas(configArquivo), ...(configArquivo.abas?.[selecao.aba] || {}) };
    return Boolean((config.cnpj || config.cpf) && config.tipo && config.valorOperadora);
  };
  const podeGerar = Boolean(
    preview && selecoesAbas.some(selecao => selecao.usar) && selecoesAbas.every(abaEstaConfigurada) &&
    colunasResultado.length > 0 && !gerando
  );

  useEffect(() => {
    let ativo = true;
    listarOperadoras()
      .then(dados => {
        if (ativo) setOperadorasBanco(Array.isArray(dados) ? dados : []);
      })
      .catch(() => {
        if (ativo) setOperadorasBanco([]);
      });
    return () => { ativo = false; };
  }, []);

  /**
   * Adiciona arquivos selecionados e limpa o preview anterior.
   */
  function selecionarArquivos(fileList) {
    setArquivos(prev => [...prev, ...Array.from(fileList || [])]);
    setPreview(null);
    setPassoAtual(0);
    setErro('');
    setSucesso('');
  }

  /**
   * Limpa o preview e a configuração derivada (a ordem das planilhas mudou).
   */
  function limparConfiguracao() {
    setPreview(null);
    setOperadorasCfg([]);
    setSelecoesAbas([]);
    setAbaConfigAtiva('');
    setColunasResultado([]);
    setPassoAtual(0);
    setErro('');
    setSucesso('');
  }

  /**
   * Remove uma planilha carregada, mantendo o principal apontando para o mesmo arquivo.
   */
  function removerArquivo(index) {
    setArquivos(prev => prev.filter((_, itemIndex) => itemIndex !== index));
    setPrincipalIndex(prev => (index < prev ? prev - 1 : index === prev ? 0 : prev));
    limparConfiguracao();
  }

  /**
   * Define qual arquivo é a planilha principal sem alterar a ordem de exibição.
   * A reordenação (principal em primeiro) acontece apenas no envio ao backend.
   */
  function definirPrincipal(index) {
    if (index === principalIndex) return;
    setPrincipalIndex(index);
    limparConfiguracao();
  }

  /**
   * Devolve os arquivos com o principal em primeiro (ordem exigida pelo backend),
   * preservando a ordem relativa das demais planilhas.
   */
  function ordenarArquivos() {
    if (principalIndex <= 0) return arquivos;
    return [arquivos[principalIndex], ...arquivos.filter((_, index) => index !== principalIndex)];
  }

  /**
   * Carrega o preview das planilhas e pré-preenche o mapeamento sugerido.
   */
  async function carregarPreview() {
    if (!todosArquivos) return false;
    setErro('');
    setSucesso('');
    setCarregandoPreview(true);

    try {
      const dados = await previewCruzamento(ordenarArquivos());
      setPreview(dados);

      const sug = dados.sugestoes || {};
      const proximasSelecoes = (dados.abasPorArquivo || []).flatMap(item => item.abas.map(aba => ({
        arquivoIndex: item.arquivoIndex,
        aba: aba.nome,
        usar: aba.total_linhas > 0,
        tipo: aba.total_linhas > 0 ? sugerirTipoAba(aba.nome, item.arquivoIndex, item.arquivo) : 'IGNORE'
      })));
      setSelecoesAbas(proximasSelecoes);
      const primeiraAbaUsada = proximasSelecoes.find(selecao => selecao.usar);
      setAbaConfigAtiva(primeiraAbaUsada ? chaveAba(primeiraAbaUsada.arquivoIndex, primeiraAbaUsada.aba) : '');
      setPrincipalCfg(['cnpj', 'razaoSocial', 'operadora', 'data', 'quantidade', 'valor'].reduce((config, campo) => (
        aplicarIndice(config, dados.principal?.colunas || [], campo)
      ), {
        cnpj: sug.principal?.cnpj || '',
        razaoSocial: sug.principal?.razaoSocial || '',
        operadora: sug.principal?.operadora || '',
        data: sug.principal?.data || '',
        quantidade: colunaQuantidade(dados.principal?.colunas)?.nome || '',
        valor: sug.principal?.valor || colunaValor(dados.principal?.colunas)?.nome || '',
        abas: {}
      }));
      setOperadorasCfg((dados.operadoras || []).map((planilha, index) => {
        const sugestao = sug.operadoras?.[index] || {};
        const tipoPreferido = colunaBaseFresh(planilha.colunas)?.nome || sugestao.tipo || '';
        return ['cnpj', 'cpf', 'razaoSocial', 'tipo'].reduce((config, campo) => (
          aplicarIndice(config, planilha.colunas || [], campo)
        ), {
          cnpj: sugestao.cnpj || '',
          cpf: sugestao.cpf || '',
          razaoSocial: sugestao.razaoSocial || '',
          tipo: tipoPreferido,
          valorOperadora: operadoraPorNomeArquivo(planilha.arquivo, operadorasBanco),
          tipoMap: montarTipoMapInicial(planilha.valoresDistintos?.[tipoPreferido] || []),
          // Colunas de contas (chips) a somar — ex.: Claro "Ctns ...". Vazio = 1 chip por linha (Vivo).
          quantidadeColunas: colunasDeChips(planilha.colunas),
          // Colunas de valor a somar (total pago na linha) — ex.: Claro "Receita ..."; Vivo "VALOR".
          valorColunas: colunasDeValor(planilha.colunas),
          abas: {}
        });
      }));
      setColunasResultado((dados.principal?.colunas || []).map(coluna => coluna.nome));
      return true;
    } catch (error) {
      setErro(error.message || 'Erro ao ler as planilhas.');
      return false;
    } finally {
      setCarregandoPreview(false);
    }
  }

  /**
   * Move uma coluna do resultado para cima ou para baixo.
   */
  function moverColuna(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= colunasResultado.length) return;
    const proximas = [...colunasResultado];
    const [item] = proximas.splice(index, 1);
    proximas.splice(novoIndex, 0, item);
    setColunasResultado(proximas);
  }

  /**
   * Remove uma coluna do resultado final.
   */
  function removerColuna(nome) {
    setColunasResultado(prev => prev.filter(item => item !== nome));
  }

  /**
   * Restaura todas as colunas da planilha principal no resultado.
   */
  function restaurarColunas() {
    setColunasResultado((preview?.principal?.colunas || []).map(coluna => coluna.nome));
  }

  /**
   * Gera o cruzamento e dispara o download do .xlsx.
   */
  async function gerar() {
    if (!podeGerar) return;
    setErro('');
    setSucesso('');
    setGerando(true);

    try {
      await processarCruzamento({
        arquivos: ordenarArquivos(),
        config: {
          principal: { ...principalCfg, colunasResultado },
          operadoras: operadorasCfg,
          selecoesAbas
        }
      });
      setSucesso('Cruzamento gerado. O download foi iniciado.');
    } catch (error) {
      setErro(error.message || 'Erro ao gerar o cruzamento.');
    } finally {
      setGerando(false);
    }
  }

  const colunasRemovidas = (preview?.principal?.colunas || [])
    .map(coluna => coluna.nome)
    .filter(nome => !colunasResultado.includes(nome));
  const abasConfiguraveis = (preview?.abasPorArquivo || [])
    .flatMap(item => item.abas.map(aba => ({ arquivoIndex: item.arquivoIndex, arquivo: item.arquivo, aba })))
    .filter(item => selecoesAbas.some(selecao => selecao.usar && selecao.arquivoIndex === item.arquivoIndex && selecao.aba === item.aba.nome));
  const ativa = abasConfiguraveis.find(item => chaveAba(item.arquivoIndex, item.aba.nome) === abaConfigAtiva) || abasConfiguraveis[0];

  function atualizarConfigAbaPrincipal(nomeAba, config) {
    setPrincipalCfg(prev => ({
      ...prev,
      abas: { ...(prev.abas || {}), [nomeAba]: config }
    }));
  }

  function atualizarConfigAbaOperadora(arquivoIndex, nomeAba, config) {
    setOperadorasCfg(prev => prev.map((item, index) => (
      index === arquivoIndex - 1
        ? { ...item, abas: { ...(item.abas || {}), [nomeAba]: config } }
        : item
    )));
  }

  function removerConfigAbaPrincipal(nomeAba) {
    setPrincipalCfg(prev => {
      const abas = { ...(prev.abas || {}) };
      delete abas[nomeAba];
      return { ...prev, abas };
    });
  }

  function removerConfigAbaOperadora(arquivoIndex, nomeAba) {
    setOperadorasCfg(prev => prev.map((item, index) => {
      if (index !== arquivoIndex - 1) return item;
      const abas = { ...(item.abas || {}) };
      delete abas[nomeAba];
      return { ...item, abas };
    }));
  }

  function personalizarAba(item) {
    const key = chaveAba(item.arquivoIndex, item.aba.nome);
    if (item.arquivoIndex === 0) {
      setPrincipalCfg(prev => ({
        ...prev,
        abas: {
          ...(prev.abas || {}),
          [item.aba.nome]: prev.abas?.[item.aba.nome] || ['cnpj', 'razaoSocial', 'operadora', 'data', 'valor'].reduce(
            (config, campo) => aplicarIndice(config, item.aba.colunas || [], campo),
            sugerirPrincipalAba(item.aba, semAbas(prev))
          )
        }
      }));
    } else {
      setOperadorasCfg(prev => prev.map((config, index) => (
        index === item.arquivoIndex - 1
          ? {
              ...config,
              abas: {
                ...(config.abas || {}),
                [item.aba.nome]: config.abas?.[item.aba.nome] || ['cnpj', 'cpf', 'razaoSocial', 'tipo'].reduce(
                  (sugerida, campo) => aplicarIndice(sugerida, item.aba.colunas || [], campo),
                  sugerirOperadoraAba(item.aba, semAbas(config))
                )
              }
            }
          : config
      )));
    }
    setAbaConfigAtiva(key);
  }

  const algumaAbaUsada = selecoesAbas.some(selecao => selecao.usar);
  const passoConcluido = {
    upload: Boolean(preview),
    abas: Boolean(preview && algumaAbaUsada),
    colunas: Boolean(preview && algumaAbaUsada && selecoesAbas.every(abaEstaConfigurada)),
    resultado: Boolean(preview && colunasResultado.length > 0)
  };

  // === Navegação por etapas (wizard) ===
  const passoAtualId = PASSOS[passoAtual].id;
  // Cada etapa só libera a próxima quando seus requisitos estão preenchidos.
  const podeAvancarPasso = {
    upload: Boolean(preview),
    abas: Boolean(preview && algumaAbaUsada),
    colunas: passoConcluido.colunas,
    resultado: podeGerar
  };
  // Motivo de bloqueio específico da etapa atual (mostrado no rodapé).
  const motivoPasso = {
    upload: !todosArquivos
      ? 'Envie ao menos 2 planilhas (a principal e uma de confirmação).'
      : !preview ? 'Clique em “Carregar e continuar” para ler as planilhas.' : '',
    abas: !algumaAbaUsada ? 'Marque ao menos uma aba para usar no cruzamento.' : '',
    colunas: !selecoesAbas.every(abaEstaConfigurada)
      ? 'Preencha as colunas obrigatórias (marcadas com *) das planilhas selecionadas.'
      : '',
    resultado: colunasResultado.length === 0 ? 'Escolha ao menos uma coluna para o resultado.' : ''
  };
  const motivoAtual = motivoPasso[passoAtualId];

  // Etapas já desbloqueadas: até a primeira incompleta (ou todas, se tudo pronto).
  const indicePrimeiroIncompleto = PASSOS.findIndex(passo => !passoConcluido[passo.id]);
  const maxDesbloqueado = indicePrimeiroIncompleto === -1 ? PASSOS.length - 1 : indicePrimeiroIncompleto;
  const podeNavegarPara = index => index <= Math.max(passoAtual, maxDesbloqueado);

  function irParaPasso(index) {
    if (index < 0 || index >= PASSOS.length || !podeNavegarPara(index)) return;
    setErro('');
    setPassoAtual(index);
  }

  /**
   * Avança uma etapa. Na etapa de upload, lê as planilhas antes de seguir.
   */
  async function avancar() {
    if (passoAtualId === 'upload' && !preview) {
      const ok = await carregarPreview();
      if (ok) setPassoAtual(1);
      return;
    }
    if (podeAvancarPasso[passoAtualId] && passoAtual < PASSOS.length - 1) {
      setErro('');
      setPassoAtual(passoAtual + 1);
    }
  }

  return (
    <LayoutPrivado>
      <div className="cruzar-page">
        <ol className="cruzar-steps" aria-label="Etapas do cruzamento">
          {PASSOS.map((passo, index) => {
            const atual = index === passoAtual;
            // Verde apenas para etapas já percorridas (e válidas), nunca para as que vêm depois.
            const concluido = index < passoAtual && passoConcluido[passo.id];
            const navegavel = podeNavegarPara(index);
            const estado = atual ? 'is-active' : concluido ? 'is-done' : '';
            return (
              <li key={passo.id} className={`cruzar-step ${estado}`} aria-current={atual ? 'step' : undefined}>
                <button
                  type="button"
                  className="cruzar-step__btn"
                  onClick={() => irParaPasso(index)}
                  disabled={!navegavel}
                >
                  <span className="cruzar-step__marker">{concluido ? <I.Check size={13} /> : index + 1}</span>
                  <span className="cruzar-step__label">{passo.rotulo}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="cruzar-page__scroll">
        {erro && <div className="alert-error">{erro}</div>}
        {sucesso && <div className="alert-success">{sucesso}</div>}

        {passoAtualId === 'upload' && (
          <section className="cruzar-section">
            <div className="cruzar-section__head">
              <span className="cruzar-step-badge">1</span>
              <div>
                <h2 className="cruzar-section__title">Envie as planilhas</h2>
                <p className="cruzar-section__sub">A primeira planilha é a principal; todas as demais são as confirmações das operadoras.</p>
              </div>
            </div>
            <div className="cruzar-uploads">
              <div className="cruzar-upload">
                <label className="cruzar-dropzone">
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={event => {
                      selecionarArquivos(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <span className="cruzar-dropzone__icon"><I.Upload size={22} /></span>
                  <span className="cruzar-dropzone__title">Clique para selecionar as planilhas</span>
                  <span className="cruzar-dropzone__sub">Formatos .xlsx e .xls · você pode enviar vários arquivos de uma vez</span>
                </label>
                {arquivos.length > 0 && (
                  <p className="cruzar-upload__hint">Marque qual arquivo é a <strong>planilha principal</strong> de vendas; os demais serão tratados como confirmações das operadoras.</p>
                )}
                {arquivos.map((arquivo, index) => (
                  <div key={`${arquivo.name}-${index}`} className={`cruzar-upload__file${index === principalIndex ? ' is-principal' : ''}`}>
                    <label className="cruzar-upload__pick" title="Definir como planilha principal">
                      <input
                        type="radio"
                        name="planilha-principal"
                        checked={index === principalIndex}
                        onChange={() => definirPrincipal(index)}
                      />
                      <span className="cruzar-upload__file-icon"><I.TableSheet size={15} /></span>
                      <span className="cruzar-upload__name">{arquivo.name}</span>
                    </label>
                    <span className="cruzar-upload__role">{index === principalIndex ? 'Principal' : 'Confirmação'}</span>
                    <button
                      type="button"
                      className="btn btn-icon btn-ghost btn-danger-icon cruzar-upload__remove"
                      onClick={() => removerArquivo(index)}
                      title={`Remover ${arquivo.name}`}
                      aria-label={`Remover ${arquivo.name}`}
                    >
                      <I.Trash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {passoAtualId === 'abas' && preview && (
          <section className="cruzar-section">
            <div className="cruzar-section__head">
              <span className="cruzar-step-badge">2</span>
              <div>
                <h2 className="cruzar-section__title">Selecione e classifique as abas</h2>
                <p className="cruzar-section__sub">Somente as abas marcadas entram no cruzamento. Abas vazias já começam ignoradas.</p>
              </div>
            </div>
            <div className="cruzar-sheet-list">
              {(preview.abasPorArquivo || []).flatMap(item => item.abas.map(aba => {
                const indice = selecoesAbas.findIndex(selecao => selecao.arquivoIndex === item.arquivoIndex && selecao.aba === aba.nome);
                const selecao = selecoesAbas[indice];
                if (!selecao) return null;
                const atualizar = alteracao => setSelecoesAbas(prev => prev.map((valor, index) => index === indice ? { ...valor, ...alteracao } : valor));
                return <div className="cruzar-sheet-row" key={`${item.arquivoIndex}-${aba.nome}`}>
                  <label><input type="checkbox" checked={selecao.usar} onChange={event => atualizar({ usar: event.target.checked })} /> {item.arquivo} — {aba.nome}</label>
                  <span>{aba.total_linhas} linhas</span>
                  <select value={selecao.tipo} onChange={event => atualizar({ tipo: event.target.value })} disabled={!selecao.usar}>
                    {TIPOS_ABA_VISIVEIS.map(tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>)}
                  </select>
                </div>;
              }))}
            </div>
          </section>
        )}

        {passoAtualId === 'colunas' && preview && (
          <section className="cruzar-section">
            <div className="cruzar-section__head">
              <span className="cruzar-step-badge">3</span>
              <div>
                <h2 className="cruzar-section__title">Configure as colunas</h2>
                <p className="cruzar-section__sub">Configure cada planilha uma vez. Se alguma aba fugir do padrão, personalize somente essa aba.</p>
              </div>
            </div>
            <ConfiguracaoAbas
              preview={preview}
              ativa={ativa}
              abasConfiguraveis={abasConfiguraveis}
              abaConfigAtiva={chaveAba(ativa?.arquivoIndex, ativa?.aba?.nome)}
              setAbaConfigAtiva={setAbaConfigAtiva}
              principalCfg={principalCfg}
              setPrincipalCfg={setPrincipalCfg}
              atualizarConfigAbaPrincipal={atualizarConfigAbaPrincipal}
              removerConfigAbaPrincipal={removerConfigAbaPrincipal}
              operadorasCfg={operadorasCfg}
              setOperadorasCfg={setOperadorasCfg}
              operadorasBanco={operadorasBanco}
              atualizarConfigAbaOperadora={atualizarConfigAbaOperadora}
              removerConfigAbaOperadora={removerConfigAbaOperadora}
              personalizarAba={personalizarAba}
            />
          </section>
        )}

        {passoAtualId === 'resultado' && preview && (
          <section className="cruzar-section">
            <div className="cruzar-section__head">
              <span className="cruzar-step-badge">4</span>
              <div>
                <h2 className="cruzar-section__title">Colunas do resultado</h2>
                <p className="cruzar-section__sub">Escolha e ordene as colunas da planilha principal que vão para o arquivo final. A coluna <strong>Tipo</strong> é sempre adicionada. Vendas canceladas — pelo <strong>STATUS</strong> ou comunicadas nas <strong>observações</strong> (OBS etc.) — saem do cruzamento e vão para uma aba <strong>“Vendas Canceladas”</strong> à parte.</p>
              </div>
            </div>

            <div className="cruzar-column-editor">
              {colunasResultado.map((nome, index) => (
                <div key={nome} className="cruzar-column-row">
                  <span className="cruzar-column-row__grip" aria-hidden="true"><I.GripVertical size={15} /></span>
                  <span className="cruzar-column-row__name">{nome}</span>
                  <span className="cruzar-column-row__pos">{index + 1}</span>
                  <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, -1)} disabled={index === 0} title="Subir" aria-label={`Subir ${nome}`}>
                    <I.ChevronDown size={15} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, 1)} disabled={index === colunasResultado.length - 1} title="Descer" aria-label={`Descer ${nome}`}>
                    <I.ChevronDown size={15} />
                  </button>
                  <button type="button" className="btn btn-icon btn-ghost btn-danger-icon" onClick={() => removerColuna(nome)} title="Remover" aria-label={`Remover ${nome}`}>
                    <I.Trash size={14} />
                  </button>
                </div>
              ))}
            </div>

            {colunasRemovidas.length > 0 && (
              <div className="cruzar-removidas">
                <span className="cruzar-removidas__label">Colunas removidas</span>
                {colunasRemovidas.map(nome => (
                  <button key={nome} type="button" className="btn btn-sm cruzar-removidas__chip" onClick={() => setColunasResultado(prev => [...prev, nome])} title={`Adicionar ${nome}`}>
                    <I.Plus size={13} /> {nome}
                  </button>
                ))}
                <button type="button" className="btn btn-sm cruzar-removidas__restore" onClick={restaurarColunas}>
                  <I.Refresh size={13} /> Restaurar todas
                </button>
              </div>
            )}
          </section>
        )}
        </div>

        <div className="cruzar-wizard-footer">
          <button
            type="button"
            className="btn"
            onClick={() => irParaPasso(passoAtual - 1)}
            disabled={passoAtual === 0 || carregandoPreview || gerando}
          >
            <I.ChevronDown size={15} style={{ transform: 'rotate(90deg)' }} /> Voltar
          </button>

          <span className="cruzar-wizard-footer__hint">
            {motivoAtual && (<><I.AlertTriangle size={14} /> {motivoAtual}</>)}
          </span>

          {passoAtualId === 'resultado' ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={gerar} disabled={!podeGerar}>
              <I.Download size={15} /> {gerando ? 'Gerando…' : 'Gerar cruzamento'}
            </button>
          ) : passoAtualId === 'upload' && !preview ? (
            <button type="button" className="btn btn-primary" onClick={avancar} disabled={!todosArquivos || carregandoPreview}>
              {carregandoPreview ? 'Lendo planilhas…' : 'Carregar e continuar'}
              {!carregandoPreview && <I.ChevronDown size={15} style={{ transform: 'rotate(-90deg)' }} />}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={avancar} disabled={!podeAvancarPasso[passoAtualId]}>
              Próximo <I.ChevronDown size={15} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          )}
        </div>
      </div>
    </LayoutPrivado>
  );
}

function ConfiguracaoAbas({
  preview,
  ativa,
  abasConfiguraveis,
  abaConfigAtiva,
  setAbaConfigAtiva,
  principalCfg,
  setPrincipalCfg,
  atualizarConfigAbaPrincipal,
  removerConfigAbaPrincipal,
  operadorasCfg,
  setOperadorasCfg,
  operadorasBanco,
  atualizarConfigAbaOperadora,
  removerConfigAbaOperadora,
  personalizarAba
}) {
  const abasPersonalizadas = abasConfiguraveis.filter(item => (
    item.arquivoIndex === 0
      ? Boolean(principalCfg.abas?.[item.aba.nome])
      : Boolean(operadorasCfg[item.arquivoIndex - 1]?.abas?.[item.aba.nome])
  ));

  return (
    <>
      <div className="cruzar-grid">
        <div className="cruzar-card">
          <div className="cruzar-card__title">
            {preview?.principal?.arquivo || 'Planilha principal'}
            <span className="cruzar-card__badge">Principal</span>
            <small className="cruzar-card__meta">{preview?.principal?.abas || 0} aba(s) · {preview?.principal?.total_linhas || 0} linha(s) lidas</small>
          </div>
          <div className="cruzar-map">
            <SelectColuna
              label="Coluna CPF/CNPJ (documento)"
              obrigatorio
              valor={principalCfg.cnpj || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'cnpj', valor, coluna))}
            />
            <SelectColuna
              label="Coluna Razão Social (fallback)"
              valor={principalCfg.razaoSocial || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'razaoSocial', valor, coluna))}
            />
            <SelectColuna
              label="Coluna Operadora"
              obrigatorio
              valor={principalCfg.operadora || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'operadora', valor, coluna))}
            />
            <SelectColuna
              label="Coluna Data (desempate)"
              valor={principalCfg.data || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'data', valor, coluna))}
            />
            <SelectColuna
              label="Coluna Quantidade (chips)"
              valor={principalCfg.quantidade || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'quantidade', valor, coluna))}
            />
            <SelectColuna
              label="Coluna Valor (por chip)"
              valor={principalCfg.valor || ''}
              colunas={preview?.principal?.colunas || []}
              amostras={preview?.principal?.amostras}
              onChange={(valor, coluna) => setPrincipalCfg(prev => atualizarCampoMapeamento(prev, 'valor', valor, coluna))}
            />
          </div>
        </div>

        {(preview?.operadoras || []).map((planilha, index) => (
          <BlocoOperadora
            key={`geral-${index}`}
            titulo={planilha.arquivo || `Planilha ${index + 2}`}
            preview={planilha}
            config={operadorasCfg[index] || { cnpj: '', cpf: '', razaoSocial: '', tipo: '', tipoMap: {} }}
            onConfig={config => setOperadorasCfg(prev => prev.map((item, itemIndex) => (
              itemIndex === index ? { ...config, abas: item?.abas || {} } : item
            )))}
            operadoras={operadorasBanco}
          />
        ))}
      </div>

      <div className="cruzar-card cruzar-card--compact">
        <div className="cruzar-card__title">
          Ajustes por aba
          <small className="cruzar-card__meta">Use apenas quando uma aba tiver colunas diferentes do padrão da planilha.</small>
        </div>
        <div className="cruzar-sheet-actions">
          {abasConfiguraveis.map(item => {
            const key = chaveAba(item.arquivoIndex, item.aba.nome);
            const personalizada = abasPersonalizadas.some(aba => chaveAba(aba.arquivoIndex, aba.aba.nome) === key);
            return (
              <button
                key={key}
                type="button"
                className={`btn ${personalizada ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => personalizarAba(item)}
              >
                {personalizada ? 'Editar' : 'Personalizar'} · {rotuloArquivo(item)} / {item.aba.nome}
              </button>
            );
          })}
        </div>
      </div>

      {abasPersonalizadas.length > 0 && (
        <div className="cruzar-sheet-tabs" role="tablist" aria-label="Abas personalizadas">
          {abasPersonalizadas.map(item => {
            const key = chaveAba(item.arquivoIndex, item.aba.nome);
            return (
            <button
              key={key}
              type="button"
              className={`cruzar-sheet-tab${key === abaConfigAtiva ? ' is-active' : ''}`}
              onClick={() => setAbaConfigAtiva(key)}
            >
              <span>{rotuloArquivo(item)}</span>
              <strong>{item.aba.nome}</strong>
            </button>
            );
          })}
        </div>
      )}

      {abasPersonalizadas.length > 0 && !ativa && <div className="cruzar-empty">Selecione uma aba personalizada para configurar.</div>}

      {ativa?.arquivoIndex === 0 && principalCfg.abas?.[ativa.aba.nome] && (
        <div className="cruzar-card">
          <div className="cruzar-card__title">
            {ativa.arquivo} (Principal) / {ativa.aba.nome}
            <small className="cruzar-card__meta">{ativa.aba.total_linhas || 0} linha(s) lidas</small>
            <button type="button" className="btn btn-ghost" onClick={() => removerConfigAbaPrincipal(ativa.aba.nome)}>
              Usar padrão da planilha
            </button>
          </div>
          <div className="cruzar-map">
            <SelectColuna
              label="Coluna CPF/CNPJ (documento)"
              obrigatorio
              valor={(principalCfg.abas?.[ativa.aba.nome] || {}).cnpj || ''}
              colunas={ativa.aba.colunas}
              amostras={ativa.aba.amostras}
              onChange={(valor, coluna) => atualizarConfigAbaPrincipal(
                ativa.aba.nome,
                atualizarCampoMapeamento(principalCfg.abas?.[ativa.aba.nome] || {}, 'cnpj', valor, coluna)
              )}
            />
            <SelectColuna
              label="Coluna Razão Social (fallback)"
              valor={(principalCfg.abas?.[ativa.aba.nome] || {}).razaoSocial || ''}
              colunas={ativa.aba.colunas}
              amostras={ativa.aba.amostras}
              onChange={(valor, coluna) => atualizarConfigAbaPrincipal(
                ativa.aba.nome,
                atualizarCampoMapeamento(principalCfg.abas?.[ativa.aba.nome] || {}, 'razaoSocial', valor, coluna)
              )}
            />
            <SelectColuna
              label="Coluna Operadora"
              obrigatorio
              valor={(principalCfg.abas?.[ativa.aba.nome] || {}).operadora || ''}
              colunas={ativa.aba.colunas}
              amostras={ativa.aba.amostras}
              onChange={(valor, coluna) => atualizarConfigAbaPrincipal(
                ativa.aba.nome,
                atualizarCampoMapeamento(principalCfg.abas?.[ativa.aba.nome] || {}, 'operadora', valor, coluna)
              )}
            />
            <SelectColuna
              label="Coluna Data (desempate)"
              valor={(principalCfg.abas?.[ativa.aba.nome] || {}).data || ''}
              colunas={ativa.aba.colunas}
              amostras={ativa.aba.amostras}
              onChange={(valor, coluna) => atualizarConfigAbaPrincipal(
                ativa.aba.nome,
                atualizarCampoMapeamento(principalCfg.abas?.[ativa.aba.nome] || {}, 'data', valor, coluna)
              )}
            />
            <SelectColuna
              label="Coluna Valor (por chip)"
              valor={(principalCfg.abas?.[ativa.aba.nome] || {}).valor || ''}
              colunas={ativa.aba.colunas}
              amostras={ativa.aba.amostras}
              onChange={(valor, coluna) => atualizarConfigAbaPrincipal(
                ativa.aba.nome,
                atualizarCampoMapeamento(principalCfg.abas?.[ativa.aba.nome] || {}, 'valor', valor, coluna)
              )}
            />
          </div>
        </div>
      )}

      {ativa && ativa.arquivoIndex > 0 && operadorasCfg[ativa.arquivoIndex - 1]?.abas?.[ativa.aba.nome] && (
        <>
          <div className="cruzar-card cruzar-card--compact">
            <div className="cruzar-card__title">
              Ajuste ativo: {ativa.arquivo} / {ativa.aba.nome}
              <button type="button" className="btn btn-ghost" onClick={() => removerConfigAbaOperadora(ativa.arquivoIndex, ativa.aba.nome)}>
                Usar padrão da planilha
              </button>
            </div>
          </div>
          <BlocoOperadora
            key={`${ativa.arquivoIndex}-${ativa.aba.nome}`}
            titulo={`${ativa.arquivo} / ${ativa.aba.nome}`}
            preview={{ ...ativa.aba, abas: 1, total_linhas: ativa.aba.total_linhas }}
            config={(operadorasCfg[ativa.arquivoIndex - 1]?.abas || {})[ativa.aba.nome] || { cnpj: '', cpf: '', razaoSocial: '', tipo: '', tipoMap: {} }}
            onConfig={config => atualizarConfigAbaOperadora(ativa.arquivoIndex, ativa.aba.nome, config)}
            operadoras={operadorasBanco}
          />
        </>
      )}
    </>
  );
}

export default CruzarVendasPage;
