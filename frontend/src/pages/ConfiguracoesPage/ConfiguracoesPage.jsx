import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
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

  async function removerItem(id) {
    const mapa = {
      operadoras: excluirOperadora,
      tiposVenda: excluirTipoVenda,
      servicos: excluirServico,
      links: excluirLinkExterno,
      regrasComissao: excluirRegraComissao
    };

    try {
      await mapa[aba](id);
      await carregarDados();
      setSucesso('Item excluido com sucesso.');
    } catch (error) {
      setErro(error.message || 'Erro ao excluir item.');
    }
  }

  function renderLinks(listaAtual) {
    return (
      <>
        <form className="form-grid" onSubmit={salvarLink}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={linkForm.ativo} onChange={e => setLinkForm({ ...linkForm, ativo: e.target.checked })} />
            Ativo
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit">{editandoId ? 'Salvar' : 'Adicionar'}</button>
            {editandoId && <button className="btn" type="button" onClick={resetarForms}>Cancelar</button>}
          </div>
        </form>

        <div className="list-table">
          <table>
            <thead><tr><th>Nome</th><th>URL</th><th>Marcador</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td className="muted">{item.url}</td>
                  <td>{item.dot}</td>
                  <td>{item.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-sm" onClick={() => editarItem(item)}>Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removerItem(item.id)}>Excluir</button>
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
        <form className="form-grid" onSubmit={salvarRegraComissao}>
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
            <label>Comissão</label>
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
            <label>Ordem</label>
            <input type="number" value={regraComissaoForm.ordem} onChange={e => setRegraComissaoForm({ ...regraComissaoForm, ordem: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={regraComissaoForm.ativo} onChange={e => setRegraComissaoForm({ ...regraComissaoForm, ativo: e.target.checked })} />
            Ativo
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit">{editandoId ? 'Salvar' : 'Adicionar'}</button>
            {editandoId && <button className="btn" type="button" onClick={resetarForms}>Cancelar</button>}
          </div>
        </form>

        <div className="list-table">
          <table>
            <thead><tr><th>Faixa</th><th>Comissão</th><th>Ordem</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td>{fmtMoeda(item.valor_min)} ate {fmtMoeda(item.valor_max)}</td>
                  <td>{fmtMoeda(item.valor_comissao)}</td>
                  <td>{item.ordem}</td>
                  <td>{item.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-sm" onClick={() => editarItem(item)}>Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removerItem(item.id)}>Excluir</button>
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
    return (
      <>
        <form className="form-grid" onSubmit={salvarSimples}>
          <div className="form-field">
            <label>Nome</label>
            <input value={formSimples.nome} onChange={e => setFormSimples({ ...formSimples, nome: e.target.value })} required />
          </div>
          <div className="form-field">
            <label>Ordem</label>
            <input type="number" value={formSimples.ordem} onChange={e => setFormSimples({ ...formSimples, ordem: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={formSimples.ativo} onChange={e => setFormSimples({ ...formSimples, ativo: e.target.checked })} />
            Ativo
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit">{editandoId ? 'Salvar' : 'Adicionar'}</button>
            {editandoId && <button className="btn" type="button" onClick={resetarForms}>Cancelar</button>}
          </div>
        </form>

        <div className="list-table">
          <table>
            <thead><tr><th>Nome</th><th>Ordem</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {listaAtual.map(item => (
                <tr key={item.id}>
                  <td>{item.nome}</td>
                  <td>{item.ordem}</td>
                  <td>{item.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-sm" onClick={() => editarItem(item)}>Editar</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removerItem(item.id)}>Excluir</button>
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

  return (
    <LayoutPrivado>
      <div className="users-page">
        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        {abas.length === 0 ? (
          <div className="empty">Você não tem permissão para gerenciar configurações.</div>
        ) : (
          <div className="panel">
            <div className="panel-header" style={{ justifyContent: 'flex-start', gap: 8 }}>
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
