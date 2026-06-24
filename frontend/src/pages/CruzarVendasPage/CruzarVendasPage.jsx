import { useState } from 'react';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { previewCruzamento, processarCruzamento } from '../../services/venda-cruzamento.service';
import './CruzarVendasPage.css';

const PLANILHAS = [
  { campo: 'principal', label: 'Planilha principal', descricao: 'Todas as vendas dos meses' },
  { campo: 'claro', label: 'Vendas concluídas Claro', descricao: 'Confirmadas pela Claro' },
  { campo: 'vivo', label: 'Vendas concluídas Vivo', descricao: 'Confirmadas pela Vivo' }
];

const OPCOES_TIPO = ['Novo', 'Base'];

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
      <select value={valor || ''} onChange={event => onChange(event.target.value)} required={obrigatorio}>
        <option value="">Selecione…</option>
        {colunas.map(coluna => (
          <option key={coluna.index} value={coluna.nome}>{coluna.nome}</option>
        ))}
      </select>
      <span title={exemplos}>{exemplos || '-'}</span>
    </div>
  );
}

/**
 * Bloco de mapeamento de uma operadora (CPF, Tipo, identificador e mapa de valores).
 */
function BlocoOperadora({ titulo, preview, config, onConfig }) {
  const colunas = preview?.colunas || [];
  const valoresTipo = config.tipo ? (preview?.valoresDistintos?.[config.tipo] || []) : [];

  /**
   * Atualiza a coluna de Tipo e reinicializa o mapa de valores.
   */
  function alterarColunaTipo(coluna) {
    const valores = preview?.valoresDistintos?.[coluna] || [];
    onConfig({ ...config, tipo: coluna, tipoMap: montarTipoMapInicial(valores) });
  }

  return (
    <div className="cruzar-card">
      <div className="cruzar-card__title">
        {titulo}
        <small className="cruzar-card__meta">{preview?.abas || 0} aba(s) · {preview?.total_linhas || 0} linha(s) lidas</small>
      </div>
      <div className="cruzar-map">
        <SelectColuna
          label="Coluna Razão Social"
          obrigatorio
          valor={config.razaoSocial}
          colunas={colunas}
          amostras={preview?.amostras}
          onChange={valor => onConfig({ ...config, razaoSocial: valor })}
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
          <label>Identificador na principal</label>
          <input
            type="text"
            value={config.valorOperadora}
            onChange={event => onConfig({ ...config, valorOperadora: event.target.value })}
            placeholder="ex.: claro"
          />
          <span>Texto que aparece na coluna de operadora</span>
        </div>
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
 * Página de cruzamento de vendas: upload das 3 planilhas, mapeamento configurável e download.
 */
function CruzarVendasPage() {
  const [arquivos, setArquivos] = useState({ principal: null, claro: null, vivo: null });
  const [preview, setPreview] = useState(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [principalCfg, setPrincipalCfg] = useState({ razaoSocial: '', operadora: '', data: '' });
  const [claroCfg, setClaroCfg] = useState({ razaoSocial: '', tipo: '', valorOperadora: 'claro', tipoMap: {} });
  const [vivoCfg, setVivoCfg] = useState({ razaoSocial: '', tipo: '', valorOperadora: 'vivo', tipoMap: {} });
  const [colunasResultado, setColunasResultado] = useState([]);

  const todosArquivos = arquivos.principal && arquivos.claro && arquivos.vivo;
  const podeGerar = Boolean(
    preview && principalCfg.razaoSocial && principalCfg.operadora &&
    claroCfg.razaoSocial && claroCfg.tipo && vivoCfg.razaoSocial && vivoCfg.tipo &&
    colunasResultado.length > 0 && !gerando
  );

  /**
   * Atualiza o arquivo selecionado e limpa o preview anterior.
   */
  function selecionarArquivo(campo, file) {
    setArquivos(prev => ({ ...prev, [campo]: file || null }));
    setPreview(null);
    setSucesso('');
  }

  /**
   * Carrega o preview das 3 planilhas e pré-preenche o mapeamento sugerido.
   */
  async function carregarPreview() {
    if (!todosArquivos) return;
    setErro('');
    setSucesso('');
    setCarregandoPreview(true);

    try {
      const dados = await previewCruzamento(arquivos);
      setPreview(dados);

      const sug = dados.sugestoes || {};
      setPrincipalCfg({
        razaoSocial: sug.principal?.razaoSocial || '',
        operadora: sug.principal?.operadora || '',
        data: sug.principal?.data || ''
      });
      setClaroCfg({
        razaoSocial: sug.claro?.razaoSocial || '',
        tipo: sug.claro?.tipo || '',
        valorOperadora: 'claro',
        tipoMap: montarTipoMapInicial(dados.claro?.valoresDistintos?.[sug.claro?.tipo] || [])
      });
      setVivoCfg({
        razaoSocial: sug.vivo?.razaoSocial || '',
        tipo: sug.vivo?.tipo || '',
        valorOperadora: 'vivo',
        tipoMap: montarTipoMapInicial(dados.vivo?.valoresDistintos?.[sug.vivo?.tipo] || [])
      });
      setColunasResultado((dados.principal?.colunas || []).map(coluna => coluna.nome));
    } catch (error) {
      setErro(error.message || 'Erro ao ler as planilhas.');
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
        principal: arquivos.principal,
        claro: arquivos.claro,
        vivo: arquivos.vivo,
        config: {
          principal: { ...principalCfg, colunasResultado },
          claro: claroCfg,
          vivo: vivoCfg
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

  return (
    <LayoutPrivado>
      <div className="cruzar-page">
        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}
        {sucesso && <div className="alert-success" style={{ marginBottom: 16 }}>{sucesso}</div>}

        <section className="cruzar-section">
          <h2 className="cruzar-section__title">1. Envie as três planilhas</h2>
          <div className="cruzar-uploads">
            {PLANILHAS.map(item => (
              <div key={item.campo} className="cruzar-upload">
                <div className="cruzar-upload__label">
                  <strong>{item.label}</strong>
                  <small>{item.descricao}</small>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={event => selecionarArquivo(item.campo, event.target.files?.[0])}
                />
                {arquivos[item.campo] && <span className="cruzar-upload__file">{arquivos[item.campo].name}</span>}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={carregarPreview} disabled={!todosArquivos || carregandoPreview}>
            {carregandoPreview ? 'Lendo planilhas…' : 'Carregar e configurar'}
          </button>
        </section>

        {preview && (
          <>
            <section className="cruzar-section">
              <h2 className="cruzar-section__title">2. Configure as colunas</h2>
              <p className="cruzar-section__sub">Diga o que é cada coluna em cada planilha. As sugestões já vêm pré-selecionadas.</p>

              <div className="cruzar-card">
                <div className="cruzar-card__title">
                  Planilha principal
                  <small className="cruzar-card__meta">{preview.principal?.abas || 0} aba(s) · {preview.principal?.total_linhas || 0} linha(s) lidas</small>
                </div>
                <div className="cruzar-map">
                  <SelectColuna
                    label="Coluna Razão Social"
                    obrigatorio
                    valor={principalCfg.razaoSocial}
                    colunas={preview.principal.colunas}
                    amostras={preview.principal.amostras}
                    onChange={valor => setPrincipalCfg(prev => ({ ...prev, razaoSocial: valor }))}
                  />
                  <SelectColuna
                    label="Coluna Operadora"
                    obrigatorio
                    valor={principalCfg.operadora}
                    colunas={preview.principal.colunas}
                    amostras={preview.principal.amostras}
                    onChange={valor => setPrincipalCfg(prev => ({ ...prev, operadora: valor }))}
                  />
                  <SelectColuna
                    label="Coluna Data (desempate)"
                    valor={principalCfg.data}
                    colunas={preview.principal.colunas}
                    amostras={preview.principal.amostras}
                    onChange={valor => setPrincipalCfg(prev => ({ ...prev, data: valor }))}
                  />
                </div>
              </div>

              <BlocoOperadora titulo="Claro" preview={preview.claro} config={claroCfg} onConfig={setClaroCfg} />
              <BlocoOperadora titulo="Vivo" preview={preview.vivo} config={vivoCfg} onConfig={setVivoCfg} />
            </section>

            <section className="cruzar-section">
              <h2 className="cruzar-section__title">3. Colunas do resultado</h2>
              <p className="cruzar-section__sub">Escolha e ordene as colunas da planilha principal que vão para o arquivo final. A coluna <strong>Tipo</strong> é sempre adicionada.</p>

              <div className="cruzar-column-editor">
                {colunasResultado.map((nome, index) => (
                  <div key={nome} className="cruzar-column-row">
                    <span>{nome}</span>
                    <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, -1)} title="Subir">↑</button>
                    <button type="button" className="btn btn-icon btn-ghost" onClick={() => moverColuna(index, 1)} title="Descer">↓</button>
                    <button type="button" className="btn btn-icon btn-ghost btn-danger-icon" onClick={() => removerColuna(nome)} title="Remover">
                      <I.Trash size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {colunasRemovidas.length > 0 && (
                <div className="cruzar-removidas">
                  <span>Removidas:</span>
                  {colunasRemovidas.map(nome => (
                    <button key={nome} type="button" className="btn btn-sm" onClick={() => setColunasResultado(prev => [...prev, nome])}>
                      + {nome}
                    </button>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={restaurarColunas}>Restaurar todas</button>
                </div>
              )}
            </section>

            <div className="cruzar-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={gerar} disabled={!podeGerar}>
                <I.Download size={15} /> {gerando ? 'Gerando…' : 'Gerar cruzamento'}
              </button>
            </div>
          </>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default CruzarVendasPage;
