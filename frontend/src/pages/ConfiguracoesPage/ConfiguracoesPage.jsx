import { useEffect, useMemo, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarLinkExterno,
  atualizarOperadora,
  atualizarServico,
  atualizarTipoVenda,
  criarLinkExterno,
  criarOperadora,
  criarServico,
  criarTipoVenda,
  excluirLinkExterno,
  excluirOperadora,
  excluirServico,
  excluirTipoVenda,
  listarLinksExternosAdmin,
  listarOperadorasAdmin,
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

function ConfiguracoesPage() {
  const usuario = getUsuarioLocal();
  const permissoes = {
    operadoras: temPermissao(usuario, 'crud_operadoras'),
    tiposVenda: temPermissao(usuario, 'crud_tipos_venda'),
    servicos: temPermissao(usuario, 'crud_servicos'),
    links: temPermissao(usuario, 'crud_links')
  };

  const abas = useMemo(() => [
    { id: 'operadoras', label: 'Operadoras', permitido: permissoes.operadoras },
    { id: 'tiposVenda', label: 'Tipos de venda', permitido: permissoes.tiposVenda },
    { id: 'servicos', label: 'Serviços', permitido: permissoes.servicos },
    { id: 'links', label: 'Links externos', permitido: permissoes.links }
  ].filter(aba => aba.permitido), [permissoes.operadoras, permissoes.tiposVenda, permissoes.servicos, permissoes.links]);

  const [aba, setAba] = useState(abas[0]?.id || '');
  const [dados, setDados] = useState({
    operadoras: [],
    tiposVenda: [],
    servicos: [],
    links: []
  });
  const [formSimples, setFormSimples] = useState(FORM_SIMPLES);
  const [linkForm, setLinkForm] = useState(LINK_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregarDados() {
    setErro('');
    setCarregando(true);

    try {
      const [operadoras, tiposVenda, servicos, links] = await Promise.all([
        permissoes.operadoras ? listarOperadorasAdmin() : Promise.resolve([]),
        permissoes.tiposVenda ? listarTiposVendaAdmin() : Promise.resolve([]),
        permissoes.servicos ? listarServicosAdmin() : Promise.resolve([]),
        permissoes.links ? listarLinksExternosAdmin() : Promise.resolve([])
      ]);

      setDados({ operadoras, tiposVenda, servicos, links });
    } catch (error) {
      setErro(error.message || 'Erro ao carregar configuracoes.');
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

    setFormSimples({
      nome: item.nome || '',
      ordem: item.ordem || 0,
      ativo: Boolean(item.ativo)
    });
  }

  async function salvarSimples(event) {
    event.preventDefault();
    setErro('');

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
    } catch (error) {
      setErro(error.message || 'Erro ao salvar configuracao.');
    }
  }

  async function salvarLink(event) {
    event.preventDefault();
    setErro('');

    const payload = { ...linkForm, ordem: Number(linkForm.ordem || 0) };

    try {
      if (editandoId) {
        await atualizarLinkExterno(editandoId, payload);
      } else {
        await criarLinkExterno(payload);
      }

      resetarForms();
      await carregarDados();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar link.');
    }
  }

  async function removerItem(id) {
    const mapa = {
      operadoras: excluirOperadora,
      tiposVenda: excluirTipoVenda,
      servicos: excluirServico,
      links: excluirLinkExterno
    };

    await mapa[aba](id);
    await carregarDados();
  }

  const listaAtual = dados[aba] || [];
  const usandoLinks = aba === 'links';

  return (
    <LayoutPrivado>
      <div className="users-page">
        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        {abas.length === 0 ? (
          <div className="empty">Voce nao tem permissao para gerenciar configuracoes.</div>
        ) : (
          <div className="panel">
            <div className="panel-header" style={{ justifyContent: 'flex-start', gap: 8 }}>
              {abas.map(item => (
                <button
                  key={item.id}
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
              ) : usandoLinks ? (
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
                              <button className="btn btn-sm" onClick={() => editarItem(item)}>Editar</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => removerItem(item.id)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
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
                              <button className="btn btn-sm" onClick={() => editarItem(item)}>Editar</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => removerItem(item.id)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </LayoutPrivado>
  );
}

export default ConfiguracoesPage;
