import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import * as I from '../../components/Icons';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarLinkExterno,
  atualizarOperadora,
  atualizarRegraComissao,
  atualizarServico,
  atualizarTipoVenda,
  criarLinkExterno,
  criarOperadora,
  criarRegraComissao,
  criarServico,
  criarTipoVenda,
  excluirLinkExterno,
  excluirOperadora,
  excluirRegraComissao,
  excluirServico,
  excluirTipoVenda,
  listarLinksExternosAdmin,
  listarOperadorasAdmin,
  listarRegrasComissaoAdmin,
  listarServicosAdmin,
  listarTiposVendaAdmin
} from '../../services/config.service';
import './ConfiguracoesPage.css';

const FORM_SIMPLES = {
  nome: '',
  ordem: 0,
  ativo: true
};

const LINK_VAZIO = {
  chave: '',
  nome: '',
  url: '',
  dot: '',
  ordem: 0,
  ativo: true
};

const REGRA_COMISSAO_VAZIA = {
  valor_min: '',
  valor_max: '',
  valor_comissao: '',
  valor_comissao_base: '',
  ordem: 0,
  ativo: true
};

function fmtMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function valorForm(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return String(valor).replace('.', ',');
}

function StatusPill({ ativo }) {
  return (
    <span className={`config-status ${ativo ? 'is-active' : 'is-inactive'}`}>
      <span />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function ConfirmarExclusaoConfigModal({ item, tipo, excluindo, onClose, onConfirm }) {
  if (!item) return null;

  const nomeItem = item.nome || item.chave || `#${item.id}`;

  return (
    <div className="modal-overlay" onClick={event => !excluindo && event.target === event.currentTarget && onClose()}>
      <div className="modal config-delete-modal" role="dialog" aria-modal="true" aria-labelledby="config-delete-title">
        <div className="modal-header">
          <div className="modal-header-row">
            <div>
              <div id="config-delete-title" className="modal-client">Excluir configuração?</div>
              <div className="modal-sub">{tipo} - {nomeItem}</div>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} disabled={excluindo} title="Fechar">
              <I.Close size={16} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="config-delete-warning">
            <div className="config-delete-icon">
              <I.AlertTriangle size={22} />
            </div>
            <div>
              <strong>Essa ação remove o cadastro das configurações.</strong>
              <p>Confira se este item não está em uso antes de confirmar. Depois da exclusão, ele deixará de aparecer nas listas do sistema.</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={excluindo}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={excluindo}>
            <I.Trash size={13} /> {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfiguracoesPage() {
  const usuario = getUsuarioLocal();
  const permissoes = {
    operadoras: temPermissao(usuario, 'crud_operadoras'),
    tiposVenda: temPermissao(usuario, 'crud_tipos_venda'),
    servicos: temPermissao(usuario, 'crud_servicos'),
    links: temPermissao(usuario, 'crud_links'),
    regrasComissao: temPermissao(usuario, 'crud_regras_comissao')
  };

  const abas = useMemo(() => [
    { id: 'operadoras', label: 'Operadoras', permitido: permissoes.operadoras },
    { id: 'tiposVenda', label: 'Tipos de venda', permitido: permissoes.tiposVenda },
    { id: 'servicos', label: 'Serviços', permitido: permissoes.servicos },
    { id: 'links', label: 'Links externos', permitido: permissoes.links },
    { id: 'regrasComissao', label: 'Comissões', permitido: permissoes.regrasComissao }
  ].filter(abaItem => abaItem.permitido), [
    permissoes.operadoras,
    permissoes.tiposVenda,
    permissoes.servicos,
    permissoes.links,
    permissoes.regrasComissao
  ]);

  const [aba, setAba] = useState(abas[0]?.id || '');
  const [dados, setDados] = useState({
    operadoras: [],
    tiposVenda: [],
    servicos: [],
    links: [],
    regrasComissao: []
  });
  const [formSimples, setFormSimples] = useState(FORM_SIMPLES);
  const [linkForm, setLinkForm] = useState(LINK_VAZIO);
  const [regraComissaoForm, setRegraComissaoForm] = useState(REGRA_COMISSAO_VAZIA);
  const [editandoId, setEditandoId] = useState(null);
  const [itemParaExcluir, setItemParaExcluir] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);

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
      const [operadoras, tiposVenda, servicos, links, regrasComissao] = await Promise.all([
        permissoes.operadoras ? listarOperadorasAdmin() : Promise.resolve([]),
        permissoes.tiposVenda ? listarTiposVendaAdmin() : Promise.resolve([]),
        permissoes.servicos ? listarServicosAdmin() : Promise.resolve([]),
        permissoes.links ? listarLinksExternosAdmin() : Promise.resolve([]),
        permissoes.regrasComissao ? listarRegrasComissaoAdmin() : Promise.resolve([])
      ]);

      setDados({ operadoras, tiposVenda, servicos, links, regrasComissao });
    } catch (error) {
      setErro(error.message || 'Erro ao carregar configurações.');
    } finally {
      setCarregando(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    carregarDados();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  function resetarForms() {
    setFormSimples(FORM_SIMPLES);
    setLinkForm(LINK_VAZIO);
    setRegraComissaoForm(REGRA_COMISSAO_VAZIA);
    setEditandoId(null);
  }

  function mudarAba(id) {
    setAba(id);
    setItemParaExcluir(null);
    resetarForms();
  }

  function editarItem(item) {
    setEditandoId(item.id);

    if (aba === 'links') {
      setLinkForm({
        chave: item.chave || '',
        nome: item.nome || '',
        url: item.url || '',
        dot: item.dot || '',
        ordem: item.ordem || 0,
        ativo: Boolean(item.ativo)
      });
      return;
    }

    if (aba === 'regrasComissao') {
      setRegraComissaoForm({
        valor_min: valorForm(item.valor_min),
        valor_max: valorForm(item.valor_max),
        valor_comissao: valorForm(item.valor_comissao),
        valor_comissao_base: valorForm(item.valor_comissao_base ?? item.valor_comissao),
        ordem: item.ordem || 0,
        ativo: Boolean(item.ativo)
      });
      return;
    }

    setFormSimples({
      nome: item.nome || '',
      ordem: item.ordem || 0,
      ativo: Boolean(item.ativo)
    });
  }

  function renderFormHeader(tituloAdicionar, tituloEditar, subtitulo) {
    return (
      <div className="config-form-header">
        <div>
          <span className="config-kicker">{editandoId ? 'Editando cadastro' : 'Novo cadastro'}</span>
          <h2>{editandoId ? tituloEditar : tituloAdicionar}</h2>
          <p>{subtitulo}</p>
        </div>
        {editandoId && (
          <button className="btn btn-ghost" type="button" onClick={resetarForms}>
            <I.Close size={14} /> Cancelar edição
          </button>
        )}
      </div>
    );
  }

  function renderFormActions(salvandoLabel = 'Salvar alterações', adicionandoLabel = 'Adicionar') {
    return (
      <div className="config-form-actions">
        <button className="btn btn-primary" type="submit">
          {editandoId ? <I.Check size={14} /> : <I.Plus size={14} />}
          {editandoId ? salvandoLabel : adicionandoLabel}
        </button>
        {editandoId && (
          <button className="btn" type="button" onClick={resetarForms}>
            Limpar
          </button>
        )}
      </div>
    );
  }

  async function salvarSimples(event) {
    event.preventDefault();
    setErro('');
    const editando = Boolean(editandoId);

    const mapa = {
      operadoras: [criarOperadora, atualizarOperadora],
      tiposVenda: [criarTipoVenda, atualizarTipoVenda],
      servicos: [criarServico, atualizarServico]
    };
    const [criar, atualizar] = mapa[aba];
    const payload = { ...formSimples, ordem: Number(formSimples.ordem || 0) };

    try {
      if (editandoId) {
        await atualizar(editandoId, payload);
      } else {
        await criar(payload);
      }

      resetarForms();
      await carregarDados();
      setSucesso(editando ? 'Configuração atualizada com sucesso.' : 'Configuração adicionada com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao salvar configuração.');
    }
  }

  async function salvarLink(event) {
    event.preventDefault();
    setErro('');
    const editando = Boolean(editandoId);
    const payload = { ...linkForm, ordem: Number(linkForm.ordem || 0) };

    try {
      if (editandoId) {
        await atualizarLinkExterno(editandoId, payload);
      } else {
        await criarLinkExterno(payload);
      }

      resetarForms();
      await carregarDados();
      setSucesso(editando ? 'Link atualizado com sucesso.' : 'Link adicionado com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao salvar link.');
    }
  }

  async function salvarRegraComissao(event) {
    event.preventDefault();
    setErro('');
    const editando = Boolean(editandoId);
    const payload = {
      ...regraComissaoForm,
      ordem: Number(regraComissaoForm.ordem || 0)
    };

    try {
      if (editandoId) {
        await atualizarRegraComissao(editandoId, payload);
      } else {
        await criarRegraComissao(payload);
      }

      resetarForms();
      await carregarDados();
      setSucesso(editando ? 'Regra atualizada com sucesso.' : 'Regra adicionada com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao salvar regra de comissão.');
    }
  }

  function solicitarExclusao(item) {
    setItemParaExcluir(item);
  }

  async function confirmarExclusao() {
    if (!itemParaExcluir) return;

    const mapa = {
      operadoras: excluirOperadora,
      tiposVenda: excluirTipoVenda,
      servicos: excluirServico,
      links: excluirLinkExterno,
      regrasComissao: excluirRegraComissao
    };

    try {
      setExcluindoId(itemParaExcluir.id);
      await mapa[aba](itemParaExcluir.id);
      if (editandoId === itemParaExcluir.id) {
        resetarForms();
      }
      setItemParaExcluir(null);
      await carregarDados();
      setSucesso('Item excluido com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir item.');
    } finally {
      setExcluindoId(null);
    }
  }

  function renderLinks(listaAtual) {
    return (
      <>
        <form className="config-form" onSubmit={salvarLink}>
          {renderFormHeader('Adicionar link externo', 'Editar link externo', 'Defina os atalhos exibidos no topo do sistema.')}
          <div className="config-form-grid config-form-grid--links">
          <div className="form-field">
            <label>Chave</label>
            <input value={linkForm.chave} onChange={e => setLinkForm({ ...linkForm, chave: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Nome</label>
            <input value={linkForm.nome} onChange={e => setLinkForm({ ...linkForm, nome: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>URL</label>
            <input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Marcador</label>
            <input value={linkForm.dot} onChange={e => setLinkForm({ ...linkForm, dot: e.target.value })} placeholder="vivo, tim, claro, gov, abr" />
          </div>
          <div className="form-field">
            <label>Ordem</label>
            <input type="number" value={linkForm.ordem} onChange={e => setLinkForm({ ...linkForm, ordem: e.target.value })} />
          </div>
          <label className="config-toggle">
            <input type="checkbox" checked={linkForm.ativo} onChange={e => setLinkForm({ ...linkForm, ativo: e.target.checked })} />
            Ativo
          </label>
          </div>
          {renderFormActions('Salvar link', 'Adicionar link')}
        </form>

        <div className="config-list-header">
          <div>
            <h3>Links cadastrados</h3>
            <p>{listaAtual.length} item(ns) encontrado(s)</p>
          </div>
        </div>

        <div className="list-table config-table">
          <table>
            <thead><tr><th>Nome</th><th>URL</th><th>Marcador</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td data-label="Nome" className="m-primary">
                    {item.nome}
                    <details className="mobile-row-drawer">
                      <summary>Ver detalhes</summary>
                      <dl>
                        <dt>URL</dt>
                        <dd>{item.url}</dd>
                        <dt>Marcador</dt>
                        <dd>{item.dot || '-'}</dd>
                      </dl>
                    </details>
                  </td>
                  <td data-label="URL" data-mobile-hidden="true" className="muted">{item.url}</td>
                  <td data-label="Marcador" data-mobile-hidden="true">{item.dot}</td>
                  <td data-label="Status" className="m-meta"><StatusPill ativo={item.ativo} /></td>
                  <td data-label="Acoes" className="row-actions m-actions">
                    <button type="button" className="btn btn-sm config-edit" onClick={() => editarItem(item)}><I.Edit size={13} /> Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost btn-danger-icon config-danger" onClick={() => solicitarExclusao(item)}><I.Trash size={13} /> Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderRegrasComissao(listaAtual) {
    return (
      <>
        <form className="config-form" onSubmit={salvarRegraComissao}>
          {renderFormHeader('Adicionar regra de comissão', 'Editar regra de comissão', 'Organize faixas de valor e comissão para vendas novas e clientes da base.')}
          <div className="config-form-grid config-form-grid--commission">
          <div className="form-field">
            <label>Valor inicial</label>
            <input
              type="text"
              inputMode="decimal"
              value={regraComissaoForm.valor_min}
              onChange={e => setRegraComissaoForm({ ...regraComissaoForm, valor_min: e.target.value })}
              placeholder="29,99"
              required
            />
          </div>
          <div className="form-field">
            <label>Valor final</label>
            <input
              type="text"
              inputMode="decimal"
              value={regraComissaoForm.valor_max}
              onChange={e => setRegraComissaoForm({ ...regraComissaoForm, valor_max: e.target.value })}
              placeholder="59,99"
              required
            />
          </div>
          <div className="form-field">
            <label>Comissao integral</label>
            <input
              type="text"
              inputMode="decimal"
              value={regraComissaoForm.valor_comissao}
              onChange={e => setRegraComissaoForm({ ...regraComissaoForm, valor_comissao: e.target.value })}
              placeholder="10,00"
              required
            />
          </div>
          <div className="form-field">
            <label>Comissao cliente da base</label>
            <input
              type="text"
              inputMode="decimal"
              value={regraComissaoForm.valor_comissao_base}
              onChange={e => setRegraComissaoForm({ ...regraComissaoForm, valor_comissao_base: e.target.value })}
              placeholder="5,00"
              required
            />
          </div>
          <div className="form-field">
            <label>Ordem</label>
            <input type="number" value={regraComissaoForm.ordem} onChange={e => setRegraComissaoForm({ ...regraComissaoForm, ordem: e.target.value })} />
          </div>
          <label className="config-toggle">
            <input type="checkbox" checked={regraComissaoForm.ativo} onChange={e => setRegraComissaoForm({ ...regraComissaoForm, ativo: e.target.checked })} />
            Ativo
          </label>
          </div>
          {renderFormActions('Salvar regra', 'Adicionar regra')}
        </form>

        <div className="config-list-header">
          <div>
            <h3>Regras cadastradas</h3>
            <p>{listaAtual.length} faixa(s) encontrada(s)</p>
          </div>
        </div>

        <div className="list-table config-table">
          <table>
            <thead><tr><th>Faixa</th><th>Integral</th><th>Cliente da base</th><th>Ordem</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td data-label="Faixa" className="m-primary">
                    {fmtMoeda(item.valor_min)} até {fmtMoeda(item.valor_max)}
                    <details className="mobile-row-drawer">
                      <summary>Ver detalhes</summary>
                      <dl>
                        <dt>Integral</dt>
                        <dd>{fmtMoeda(item.valor_comissao)}</dd>
                        <dt>Cliente da base</dt>
                        <dd>{fmtMoeda(item.valor_comissao_base ?? item.valor_comissao)}</dd>
                        <dt>Ordem</dt>
                        <dd>{item.ordem}</dd>
                      </dl>
                    </details>
                  </td>
                  <td data-label="Integral" data-mobile-hidden="true">{fmtMoeda(item.valor_comissao)}</td>
                  <td data-label="Cliente da base" data-mobile-hidden="true">{fmtMoeda(item.valor_comissao_base ?? item.valor_comissao)}</td>
                  <td data-label="Ordem" data-mobile-hidden="true">{item.ordem}</td>
                  <td data-label="Status" className="m-meta"><StatusPill ativo={item.ativo} /></td>
                  <td data-label="Acoes" className="row-actions m-actions">
                    <button type="button" className="btn btn-sm config-edit" onClick={() => editarItem(item)}><I.Edit size={13} /> Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost btn-danger-icon config-danger" onClick={() => solicitarExclusao(item)}><I.Trash size={13} /> Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function renderSimples(listaAtual) {
    const labelAtual = abas.find(item => item.id === aba)?.label || 'item';

    return (
      <>
        <form className="config-form" onSubmit={salvarSimples}>
          {renderFormHeader(`Adicionar ${labelAtual.toLowerCase()}`, `Editar ${labelAtual.toLowerCase()}`, 'Cadastre o nome, defina a ordem de exibição e controle se o item fica disponível no sistema.')}
          <div className="config-form-grid config-form-grid--simple">
          <div className="form-field">
            <label>Nome</label>
            <input value={formSimples.nome} onChange={e => setFormSimples({ ...formSimples, nome: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Ordem</label>
            <input type="number" value={formSimples.ordem} onChange={e => setFormSimples({ ...formSimples, ordem: e.target.value })} />
          </div>
          <label className="config-toggle">
            <input type="checkbox" checked={formSimples.ativo} onChange={e => setFormSimples({ ...formSimples, ativo: e.target.checked })} />
            Ativo
          </label>
          </div>
          {renderFormActions('Salvar alterações', 'Adicionar')}
        </form>

        <div className="config-list-header">
          <div>
            <h3>{labelAtual} cadastrados</h3>
            <p>{listaAtual.length} item(ns) encontrado(s)</p>
          </div>
        </div>

        <div className="list-table config-table">
          <table>
            <thead><tr><th>Nome</th><th>Ordem</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td data-label="Nome" className="m-primary">
                    {item.nome}
                    <details className="mobile-row-drawer">
                      <summary>Ver detalhes</summary>
                      <dl>
                        <dt>Ordem</dt>
                        <dd>{item.ordem}</dd>
                      </dl>
                    </details>
                  </td>
                  <td data-label="Ordem" data-mobile-hidden="true">{item.ordem}</td>
                  <td data-label="Status" className="m-meta"><StatusPill ativo={item.ativo} /></td>
                  <td data-label="Acoes" className="row-actions m-actions">
                    <button type="button" className="btn btn-sm config-edit" onClick={() => editarItem(item)}><I.Edit size={13} /> Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost btn-danger-icon config-danger" onClick={() => solicitarExclusao(item)}><I.Trash size={13} /> Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const listaAtual = dados[aba] || [];
  const abaAtual = abas.find(item => item.id === aba);

  return (
    <LayoutPrivado>
      <div className="users-page configuracoes-page">
        <ConfirmarExclusaoConfigModal
          item={itemParaExcluir}
          tipo={abaAtual?.label || 'Configuração'}
          excluindo={excluindoId === itemParaExcluir?.id}
          onClose={() => setItemParaExcluir(null)}
          onConfirm={confirmarExclusao}
        />

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        {abas.length === 0 ? (
          <div className="empty">Você não tem permissão para gerenciar configurações.</div>
        ) : (
          <div className="panel config-panel">
            <div className="panel-header config-panel-header">
              <div className="config-tabs">
                {abas.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`filter-chip ${aba === item.id ? 'active' : ''}`}
                    onClick={() => mudarAba(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="config-panel-summary">
                <strong>{abaAtual?.label}</strong>
                <span>{listaAtual.length} cadastrado(s)</span>
              </div>
            </div>

            <div className="panel-body">
              {carregando ? (
                <div className="muted">Carregando...</div>
              ) : aba === 'links' ? (
                renderLinks(listaAtual)
              ) : aba === 'regrasComissao' ? (
                renderRegrasComissao(listaAtual)
              ) : (
                renderSimples(listaAtual)
              )}
            </div>
          </div>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default ConfiguracoesPage;
