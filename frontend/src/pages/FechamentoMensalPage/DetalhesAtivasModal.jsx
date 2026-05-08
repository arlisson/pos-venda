import { useEffect, useMemo, useState } from 'react';
import * as I from '../../components/Icons';
import { getDetalhesChips } from '../../services/fechamento.service';

const DADOS_VAZIOS = {
  linhas: [],
  totais_por_vendedora: [],
  total_geral: {
    chips: 0,
    valor: 0,
    comissao: 0,
    ugrs_sem_regra: 0
  }
};

const FILTROS_INICIAIS = {
  vendaId: '',
  vendaTexto: '',
  vendedora: '',
  operadora: '',
  etapa: '',
  tipoVenda: '',
  servico: '',
  repasse: '',
  regra: ''
};

function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(valor) {
  if (!valor) return '-';
  const iso = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function fmtBool(valor) {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return '-';
}

function fmtTexto(valor) {
  return String(valor || '').trim() || '-';
}

function fmtLista(valor) {
  if (!valor) return '-';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '-';
  if (typeof valor === 'object') return JSON.stringify(valor);

  const texto = String(valor).trim();
  if (!texto) return '-';

  try {
    const parsed = JSON.parse(texto);
    return fmtLista(parsed);
  } catch {
    return texto;
  }
}

function juntarValores(valores, separador = ', ') {
  const texto = (valores || []).map(item => String(item || '').trim()).filter(Boolean).join(separador);
  return texto || '-';
}

function fmtEndereco(linha) {
  return juntarValores([
    linha.endereco,
    linha.numero_endereco,
    linha.complemento,
    linha.bairro,
    linha.municipio,
    linha.uf,
    linha.cep
  ]);
}

function fmtEnderecoReal(linha) {
  return juntarValores([
    linha.endereco_real,
    linha.numero_endereco_real,
    linha.complemento_real,
    linha.bairro_real,
    linha.municipio_real,
    linha.uf_real,
    linha.cep_real
  ]);
}

function fmtRegra(regra) {
  if (!regra) return 'Sem regra';
  return `${fmtMoeda(regra.valor_min)} até ${fmtMoeda(regra.valor_max)}`;
}

function fmtRepasse(linha) {
  return linha.cliente_base_operadora ? 'Base da operadora' : 'Cliente novo/portabilidade';
}

function fmtEtapaFunil(codigo) {
  const etapas = {
    aprovacao: 'Aprovacao',
    ativacao: 'Ativacao',
    envio: 'Envio',
    entrega: 'Entrega',
    confirmacao: 'Confirmacao',
    concluido: 'Concluido',
    retorno: 'Retorno'
  };

  return etapas[codigo] || codigo || '-';
}

function classeEtapaFunil(codigo) {
  if (codigo === 'retorno') return 'is-return';
  if (codigo === 'concluido') return 'is-final';
  return '';
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function chaveOpcao(valor) {
  return normalizarBusca(valor);
}

function criarOpcoes(linhas, obterValor, obterLabel = obterValor) {
  const mapa = new Map();

  linhas.forEach(linha => {
    const valor = obterValor(linha);
    const chave = chaveOpcao(valor);
    if (!chave || mapa.has(chave)) return;
    mapa.set(chave, {
      value: chave,
      label: obterLabel(linha) || valor || '-'
    });
  });

  return Array.from(mapa.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function valoresBuscaLinha(linha) {
  return [
    linha.venda_id,
    `#${linha.venda_id}`,
    linha.protocolo,
    linha.login,
    linha.numero_cliente_contrato,
    linha.nome,
    linha.razao_social,
    linha.cnpj,
    linha.email,
    linha.email_2,
    linha.telefone,
    linha.fixo_ddd,
    linha.nome_representante_legal,
    linha.cpf_representante_legal,
    linha.telefone_representante_legal,
    linha.email_representante_legal,
    linha.nome_administrador,
    linha.cpf_administrador,
    linha.telefone_administrador,
    linha.email_administrador,
    linha.nome_fechou_venda,
    linha.setor_funcao,
    linha.chip_index,
    linha.numero_ativado,
    linha.numero_portado,
    linha.data_ativacao,
    fmtData(linha.data_ativacao),
    linha.data_venda,
    fmtData(linha.data_venda),
    linha.vendedora?.nome,
    linha.vendedora?.email,
    linha.cliente?.nome,
    linha.cliente?.razao_social,
    linha.cliente?.cnpj,
    linha.cliente?.fidelidade_fim,
    linha.cliente?.operadora_atual?.nome,
    linha.operadora?.nome,
    linha.status_funil,
    fmtEtapaFunil(linha.status_funil),
    fmtRepasse(linha),
    linha.tipo_venda,
    linha.servico,
    linha.dia_vencimento,
    linha.ddd,
    linha.gb,
    fmtLista(linha.numeros_ativados),
    fmtLista(linha.cliente_solicitou_servicos),
    linha.cliente_solicitou_bloqueio_qtd,
    linha.cliente_solicitou_cancelamento_qtd,
    fmtLista(linha.cliente_solicitou_numeros),
    linha.qc_feito_por,
    linha.promessa_cliente,
    linha.promessa_cumprida,
    linha.observacoes,
    fmtEndereco(linha),
    fmtBool(linha.endereco_real_divergente),
    fmtEnderecoReal(linha),
    linha.ponto_referencia,
    linha.tipo_local_cpf,
    linha.horario_aceite_inicio,
    linha.horario_aceite_fim,
    linha.dia_aceite_inicio,
    linha.dia_aceite_fim,
    linha.motivo_retorno,
    linha.status_anterior_retorno,
    linha.valor_unitario,
    fmtMoeda(linha.valor_unitario),
    linha.regra_comissao?.valor_min,
    linha.regra_comissao?.valor_max,
    fmtRegra(linha.regra_comissao),
    linha.comissao_integral,
    linha.comissao_base,
    linha.comissao,
    fmtMoeda(linha.comissao)
  ].map(valor => normalizarBusca(valor)).join(' ');
}

function calcularTotais(linhas) {
  const totaisVendedora = new Map();

  linhas.forEach(linha => {
    if (linha.comissao === null || !linha.vendedora) return;
    const chave = linha.vendedora.id || 'sem_vendedora';
    const atual = totaisVendedora.get(chave) || {
      vendedora_id: linha.vendedora.id || null,
      vendedora_nome: linha.vendedora.nome || 'Sem vendedora',
      total_ugrs: 0,
      total_comissao: 0
    };

    atual.total_ugrs += 1;
    atual.total_comissao += Number(linha.comissao || 0);
    totaisVendedora.set(chave, atual);
  });

  return {
    totais_por_vendedora: Array.from(totaisVendedora.values())
      .map(item => ({ ...item, total_comissao: Number(item.total_comissao.toFixed(2)) }))
      .sort((a, b) => b.total_comissao - a.total_comissao),
    total_geral: {
      chips: linhas.length,
      valor: Number(linhas.reduce((soma, linha) => soma + Number(linha.valor_unitario || 0), 0).toFixed(2)),
      comissao: Number(linhas.reduce((soma, linha) => soma + Number(linha.comissao || 0), 0).toFixed(2)),
      ugrs_sem_regra: linhas.filter(linha => linha.sem_regra).length
    }
  };
}

function DetalhesAtivasModal({ secao = 'ativas', periodo, onClose, onAbrirVenda, reloadKey = 0 }) {
  const [dados, setDados] = useState(DADOS_VAZIOS);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);

    getDetalhesChips({ secao, ...periodo })
      .then(resp => {
        if (!ativo) return;
        setDados({
          ...DADOS_VAZIOS,
          ...(resp || {}),
          total_geral: {
            ...DADOS_VAZIOS.total_geral,
            ...(resp?.total_geral || {})
          }
        });
      })
      .catch(err => {
        if (!ativo) return;
        setErro(err?.message || 'Erro ao carregar detalhes por chip.');
      })
      .finally(() => {
        if (!ativo) return;
        setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [secao, periodo, reloadKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const linhasBase = useMemo(() => (Array.isArray(dados.linhas) ? dados.linhas : []), [dados.linhas]);

  const opcoesFiltro = useMemo(() => ({
    vendedoras: criarOpcoes(linhasBase, linha => linha.vendedora?.id || linha.vendedora?.nome, linha => linha.vendedora?.nome),
    operadoras: criarOpcoes(linhasBase, linha => linha.operadora?.id || linha.operadora?.nome, linha => linha.operadora?.nome),
    etapas: criarOpcoes(linhasBase, linha => linha.status_funil, linha => fmtEtapaFunil(linha.status_funil)),
    tiposVenda: criarOpcoes(linhasBase, linha => linha.tipo_venda),
    servicos: criarOpcoes(linhasBase, linha => linha.servico),
    repasses: [
      { value: 'base', label: 'Base da operadora' },
      { value: 'novo', label: 'Cliente novo/portabilidade' }
    ],
    regras: [
      { value: 'com_regra', label: 'Com regra' },
      { value: 'sem_regra', label: 'Sem regra' }
    ]
  }), [linhasBase]);

  const filtrosAtivos = Object.values(filtros).some(Boolean) || Boolean(busca.trim());

  const linhasFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    const vendaId = normalizarBusca(filtros.vendaId).replace(/^#/, '');
    const textoVenda = normalizarBusca(filtros.vendaTexto);

    return linhasBase.filter(linha => {
      if (vendaId && !normalizarBusca(linha.venda_id).includes(vendaId)) return false;
      if (textoVenda) {
        const alvoVenda = [
          linha.protocolo,
          linha.login,
          linha.numero_cliente_contrato,
          linha.cliente?.nome,
          linha.cliente?.razao_social,
          linha.cliente?.cnpj,
          linha.nome,
          linha.razao_social,
          linha.cnpj
        ].map(valor => normalizarBusca(valor)).join(' ');
        if (!alvoVenda.includes(textoVenda)) return false;
      }
      if (filtros.vendedora && chaveOpcao(linha.vendedora?.id || linha.vendedora?.nome) !== filtros.vendedora) return false;
      if (filtros.operadora && chaveOpcao(linha.operadora?.id || linha.operadora?.nome) !== filtros.operadora) return false;
      if (filtros.etapa && chaveOpcao(linha.status_funil) !== filtros.etapa) return false;
      if (filtros.tipoVenda && chaveOpcao(linha.tipo_venda) !== filtros.tipoVenda) return false;
      if (filtros.servico && chaveOpcao(linha.servico) !== filtros.servico) return false;
      if (filtros.repasse === 'base' && !linha.cliente_base_operadora) return false;
      if (filtros.repasse === 'novo' && linha.cliente_base_operadora) return false;
      if (filtros.regra === 'com_regra' && linha.sem_regra) return false;
      if (filtros.regra === 'sem_regra' && !linha.sem_regra) return false;
      if (termo && !valoresBuscaLinha(linha).includes(termo)) return false;
      return true;
    });
  }, [busca, filtros, linhasBase]);

  const totaisFiltrados = useMemo(() => calcularTotais(linhasFiltradas), [linhasFiltradas]);
  const totalGeral = totaisFiltrados.total_geral;
  const totaisPorVendedora = totaisFiltrados.totais_por_vendedora;
  const titulosSecao = {
    total: 'Detalhes - Total de vendas (linha por UGR)',
    tratando: 'Detalhes - Contratos tratando (linha por UGR)',
    ativas: 'Detalhes - Vendas ativas (linha por UGR)'
  };

  function abrirVenda(vendaId) {
    if (!vendaId) return;
    onAbrirVenda?.(vendaId);
  }

  function handleLinhaKeyDown(event, vendaId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirVenda(vendaId);
    }
  }

  function atualizarFiltro(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  }

  function limparFiltros() {
    setBusca('');
    setFiltros(FILTROS_INICIAIS);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fechamento-modal-large" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div className="modal-client">{titulosSecao[secao] || 'Detalhes - linha por UGR'}</div>
              <div className="modal-sub">
                {linhasFiltradas.length} de {dados.linhas.length} UGR(s) - Comissão total: {fmtMoeda(totalGeral.comissao)}
                {totalGeral.ugrs_sem_regra > 0 && (
                  <span className="fechamento-pendencia">
                    {totalGeral.ugrs_sem_regra} sem regra
                  </span>
                )}
              </div>
            </div>
            <button type="button" className="btn-icon btn-ghost" onClick={onClose} aria-label="Fechar">
              <I.Close size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {erro && <div className="alert-error" style={{ margin: 16 }}>{erro}</div>}
          {loading ? (
            <div className="fechamento-empty">Carregando...</div>
          ) : dados.linhas.length === 0 ? (
            <div className="fechamento-empty">Nenhum chip no periodo.</div>
          ) : (
            <>
              <div className="fechamento-modal-filters">
                <div className="fechamento-modal-filters__grid">
                  <label>
                    <span>Venda #</span>
                    <input
                      type="search"
                      value={filtros.vendaId}
                      onChange={event => atualizarFiltro('vendaId', event.target.value)}
                      placeholder="Ex: 123"
                    />
                  </label>
                  <label>
                    <span>Cliente / protocolo</span>
                    <input
                      type="search"
                      value={filtros.vendaTexto}
                      onChange={event => atualizarFiltro('vendaTexto', event.target.value)}
                      placeholder="Nome, CNPJ, login..."
                    />
                  </label>
                  <label>
                    <span>Vendedora</span>
                    <select value={filtros.vendedora} onChange={event => atualizarFiltro('vendedora', event.target.value)}>
                      <option value="">Todas</option>
                      {opcoesFiltro.vendedoras.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Operadora</span>
                    <select value={filtros.operadora} onChange={event => atualizarFiltro('operadora', event.target.value)}>
                      <option value="">Todas</option>
                      {opcoesFiltro.operadoras.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Etapa</span>
                    <select value={filtros.etapa} onChange={event => atualizarFiltro('etapa', event.target.value)}>
                      <option value="">Todas</option>
                      {opcoesFiltro.etapas.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Tipo</span>
                    <select value={filtros.tipoVenda} onChange={event => atualizarFiltro('tipoVenda', event.target.value)}>
                      <option value="">Todos</option>
                      {opcoesFiltro.tiposVenda.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Serviço</span>
                    <select value={filtros.servico} onChange={event => atualizarFiltro('servico', event.target.value)}>
                      <option value="">Todos</option>
                      {opcoesFiltro.servicos.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Repasse</span>
                    <select value={filtros.repasse} onChange={event => atualizarFiltro('repasse', event.target.value)}>
                      <option value="">Todos</option>
                      {opcoesFiltro.repasses.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Regra</span>
                    <select value={filtros.regra} onChange={event => atualizarFiltro('regra', event.target.value)}>
                      <option value="">Todas</option>
                      {opcoesFiltro.regras.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                    </select>
                  </label>
                  <label className="fechamento-modal-filters__wide">
                    <span>Busca geral</span>
                    <input
                      type="search"
                      value={busca}
                      onChange={event => setBusca(event.target.value)}
                      placeholder="Buscar em todos os campos"
                    />
                  </label>
                </div>
                <div className="fechamento-modal-filters__footer">
                  <span>{filtrosAtivos ? `${linhasFiltradas.length} resultado(s) filtrado(s)` : 'Sem filtros aplicados'}</span>
                  <button type="button" className="btn btn-sm" onClick={limparFiltros} disabled={!filtrosAtivos}>
                    Limpar filtros
                  </button>
                </div>
              </div>
              {linhasFiltradas.length === 0 ? (
                <div className="fechamento-empty">Nenhum resultado para a busca.</div>
              ) : (
              <div className="fechamento-modal-table-wrapper">
                <table className="fechamento-modal-table">
                  <thead>
                    <tr>
                      <th>Venda / etapa</th>
                      <th>Protocolo</th>
                      <th>Login</th>
                      <th>Contrato</th>
                      <th>Ativacao</th>
                      <th>Venda</th>
                      <th>Prioridade</th>
                      <th>Vendedora</th>
                      <th>Cliente</th>
                      <th>Nome venda</th>
                      <th>Razão venda</th>
                      <th>CNPJ</th>
                      <th>CNPJ venda</th>
                      <th>E-mail</th>
                      <th>E-mail 2</th>
                      <th>Celular</th>
                      <th>Fixo</th>
                      <th>Fechada com</th>
                      <th>Setor/Função</th>
                      <th>Nome RL</th>
                      <th>CPF RL</th>
                      <th>Telefone RL</th>
                      <th>E-mail RL</th>
                      <th>Nome ADM</th>
                      <th>CPF ADM</th>
                      <th>Telefone ADM</th>
                      <th>E-mail ADM</th>
                      <th>Operadora</th>
                      <th>Etapa</th>
                      <th>Operadora atual</th>
                      <th>Repasse</th>
                      <th>Tipo</th>
                      <th>Serviço</th>
                      <th className="num">Vencimento</th>
                      <th>Cliente solicitou</th>
                      <th>Qtd. bloqueio</th>
                      <th>Qtd. cancelamento</th>
                      <th>Números solicitados</th>
                      <th>Números portados</th>
                      <th>Endereço Receita</th>
                      <th>Endereço real divergente</th>
                      <th>Endereço real</th>
                      <th>Ponto referência</th>
                      <th>Local CPF</th>
                      <th>Janela aceite</th>
                      <th>Dias aceite</th>
                      <th>QC feito por</th>
                      <th>Promessa</th>
                      <th>Promessa cumprida</th>
                      <th>Observações</th>
                      <th>Motivo retorno</th>
                      <th>Status anterior retorno</th>
                      <th>Chip</th>
                      <th>Número ativado</th>
                      <th>DDD</th>
                      <th>GB</th>
                      <th>Fidelidade</th>
                      <th className="num">Valor chip</th>
                      <th>Regra</th>
                      <th className="num">Comissão R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.map((linha, idx) => (
                      <tr
                        key={`${linha.venda_id}-${linha.chip_index}-${idx}`}
                        className={`${linha.sem_regra ? 'row-warning ' : ''}is-clickable`}
                        tabIndex={0}
                        title="Abrir venda"
                        onClick={() => abrirVenda(linha.venda_id)}
                        onKeyDown={event => handleLinhaKeyDown(event, linha.venda_id)}
                      >
                        <td>
                          <div className="fechamento-venda-etapa">
                            <strong>#{linha.venda_id}</strong>
                            <span className={`fechamento-etapa-badge ${classeEtapaFunil(linha.status_funil)}`}>
                              {fmtEtapaFunil(linha.status_funil)}
                            </span>
                          </div>
                        </td>
                        <td>{fmtTexto(linha.protocolo)}</td>
                        <td>{fmtTexto(linha.login)}</td>
                        <td>{fmtTexto(linha.numero_cliente_contrato)}</td>
                        <td>{fmtData(linha.data_ativacao)}</td>
                        <td>{fmtData(linha.data_venda)}</td>
                        <td>{fmtTexto(linha.prioridade_funil)}</td>
                        <td>{linha.vendedora?.nome || '-'}</td>
                        <td>{linha.cliente?.nome || linha.cliente?.razao_social || '-'}</td>
                        <td>{fmtTexto(linha.nome)}</td>
                        <td>{fmtTexto(linha.razao_social)}</td>
                        <td>{linha.cliente?.cnpj || '-'}</td>
                        <td>{fmtTexto(linha.cnpj)}</td>
                        <td>{fmtTexto(linha.email)}</td>
                        <td>{fmtTexto(linha.email_2)}</td>
                        <td>{fmtTexto(linha.telefone)}</td>
                        <td>{fmtTexto(linha.fixo_ddd)}</td>
                        <td>{fmtTexto(linha.nome_fechou_venda)}</td>
                        <td>{fmtTexto(linha.setor_funcao)}</td>
                        <td>{fmtTexto(linha.nome_representante_legal)}</td>
                        <td>{fmtTexto(linha.cpf_representante_legal)}</td>
                        <td>{fmtTexto(linha.telefone_representante_legal)}</td>
                        <td>{fmtTexto(linha.email_representante_legal)}</td>
                        <td>{fmtTexto(linha.nome_administrador)}</td>
                        <td>{fmtTexto(linha.cpf_administrador)}</td>
                        <td>{fmtTexto(linha.telefone_administrador)}</td>
                        <td>{fmtTexto(linha.email_administrador)}</td>
                        <td>{linha.operadora?.nome || '-'}</td>
                        <td>{fmtEtapaFunil(linha.status_funil)}</td>
                        <td>{linha.cliente?.operadora_atual?.nome || '-'}</td>
                        <td>{fmtRepasse(linha)}</td>
                        <td>{linha.tipo_venda || '-'}</td>
                        <td>{linha.servico || '-'}</td>
                        <td className="num">{linha.dia_vencimento ?? '-'}</td>
                        <td>{fmtLista(linha.cliente_solicitou_servicos)}</td>
                        <td>{linha.cliente_solicitou_bloqueio_qtd ?? '-'}</td>
                        <td>{linha.cliente_solicitou_cancelamento_qtd ?? '-'}</td>
                        <td>{fmtLista(linha.cliente_solicitou_numeros)}</td>
                        <td>{linha.numero_portado || '-'}</td>
                        <td>{fmtEndereco(linha)}</td>
                        <td>{fmtBool(linha.endereco_real_divergente)}</td>
                        <td>{fmtEnderecoReal(linha)}</td>
                        <td>{fmtTexto(linha.ponto_referencia)}</td>
                        <td>{fmtTexto(linha.tipo_local_cpf)}</td>
                        <td>{juntarValores([linha.horario_aceite_inicio, linha.horario_aceite_fim], ' até ')}</td>
                        <td>{juntarValores([linha.dia_aceite_inicio, linha.dia_aceite_fim], ' até ')}</td>
                        <td>{fmtTexto(linha.qc_feito_por)}</td>
                        <td>{fmtTexto(linha.promessa_cliente)}</td>
                        <td>{fmtTexto(linha.promessa_cumprida)}</td>
                        <td>{fmtTexto(linha.observacoes)}</td>
                        <td>{fmtTexto(linha.motivo_retorno)}</td>
                        <td>{fmtTexto(linha.status_anterior_retorno)}</td>
                        <td>{linha.chip_index}</td>
                        <td>{linha.numero_ativado || '-'}</td>
                        <td>{linha.ddd || '-'}</td>
                        <td>{linha.gb || '-'}</td>
                        <td>{fmtData(linha.cliente?.fidelidade_fim)}</td>
                        <td className="num">{fmtMoeda(linha.valor_unitario)}</td>
                        <td>{fmtRegra(linha.regra_comissao)}</td>
                        <td className="num">{linha.comissao != null ? fmtMoeda(linha.comissao) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              )}

              <div className="fechamento-totais">
                <div className="fechamento-totais__title">Comissão por vendedora</div>
                {totaisPorVendedora.length === 0 ? (
                  <div className="muted">Nenhuma comissão calculada.</div>
                ) : (
                  totaisPorVendedora.map(item => (
                    <div className="fechamento-totais__row" key={item.vendedora_id ?? item.vendedora_nome}>
                      <span>{item.vendedora_nome} <span className="muted">({item.total_ugrs} UGRs)</span></span>
                      <strong>{fmtMoeda(item.total_comissao)}</strong>
                    </div>
                  ))
                )}
                <div className="fechamento-totais__geral">
                  <span>Total geral</span>
                  <span>{fmtMoeda(totalGeral.comissao)}</span>
                </div>
                {totalGeral.ugrs_sem_regra > 0 && (
                  <div className="muted">
                    {totalGeral.ugrs_sem_regra} UGR(s) sem regra não entram nos totais.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default DetalhesAtivasModal;
