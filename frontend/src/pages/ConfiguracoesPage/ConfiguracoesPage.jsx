import React, { useEffect, useState } from 'react';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import {
  atualizarLinkExterno,
  atualizarOperadora,
  criarLinkExterno,
  criarOperadora,
  excluirLinkExterno,
  excluirOperadora,
  listarLinksExternosAdmin,
  listarOperadorasAdmin
} from '../../services/config.service';

const LINK_VAZIO = {
  chave: '',
  nome: '',
  url: '',
  dot: '',
  ordem: 0,
  ativo: true
};

const OPERADORA_VAZIA = {
  nome: '',
  ordem: 0,
  ativo: true
};

function ConfiguracoesPage() {
  const usuario = getUsuarioLocal();
  const podeOperadoras = temPermissao(usuario, 'crud_operadoras');
  const podeLinks = temPermissao(usuario, 'crud_links');
  const [aba, setAba] = useState(podeOperadoras ? 'operadoras' : 'links');
  const [operadoras, setOperadoras] = useState([]);
  const [links, setLinks] = useState([]);
  const [operadoraForm, setOperadoraForm] = useState(OPERADORA_VAZIA);
  const [linkForm, setLinkForm] = useState(LINK_VAZIO);
  const [editandoOperadoraId, setEditandoOperadoraId] = useState(null);
  const [editandoLinkId, setEditandoLinkId] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregarDados() {
    setErro('');
    setCarregando(true);

    try {
      const [operadorasData, linksData] = await Promise.all([
        podeOperadoras ? listarOperadorasAdmin() : Promise.resolve([]),
        podeLinks ? listarLinksExternosAdmin() : Promise.resolve([])
      ]);

      setOperadoras(operadorasData);
      setLinks(linksData);
    } catch (error) {
      setErro(error.message || 'Erro ao carregar configuracoes.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function salvarOperadora(event) {
    event.preventDefault();
    setErro('');

    try {
      const dados = {
        ...operadoraForm,
        ordem: Number(operadoraForm.ordem || 0)
      };

      if (editandoOperadoraId) {
        await atualizarOperadora(editandoOperadoraId, dados);
      } else {
        await criarOperadora(dados);
      }

      setOperadoraForm(OPERADORA_VAZIA);
      setEditandoOperadoraId(null);
      await carregarDados();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar operadora.');
    }
  }

  async function salvarLink(event) {
    event.preventDefault();
    setErro('');

    try {
      const dados = {
        ...linkForm,
        ordem: Number(linkForm.ordem || 0)
      };

      if (editandoLinkId) {
        await atualizarLinkExterno(editandoLinkId, dados);
      } else {
        await criarLinkExterno(dados);
      }

      setLinkForm(LINK_VAZIO);
      setEditandoLinkId(null);
      await carregarDados();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar link.');
    }
  }

  async function removerOperadora(id) {
    await excluirOperadora(id);
    await carregarDados();
  }

  async function removerLink(id) {
    await excluirLinkExterno(id);
    await carregarDados();
  }

  function editarOperadora(operadora) {
    setEditandoOperadoraId(operadora.id);
    setOperadoraForm({
      nome: operadora.nome || '',
      ordem: operadora.ordem || 0,
      ativo: Boolean(operadora.ativo)
    });
  }

  function editarLink(link) {
    setEditandoLinkId(link.id);
    setLinkForm({
      chave: link.chave || '',
      nome: link.nome || '',
      url: link.url || '',
      dot: link.dot || '',
      ordem: link.ordem || 0,
      ativo: Boolean(link.ativo)
    });
  }

  return (
    <LayoutPrivado>
      <div className="users-page">
        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        {!podeOperadoras && !podeLinks ? (
          <div className="empty">Voce nao tem permissao para gerenciar configuracoes.</div>
        ) : (
          <div className="panel">
            <div className="panel-header" style={{ justifyContent: 'flex-start', gap: 8 }}>
              {podeOperadoras && (
                <button className={`filter-chip ${aba === 'operadoras' ? 'active' : ''}`} onClick={() => setAba('operadoras')}>
                  Operadoras
                </button>
              )}
              {podeLinks && (
                <button className={`filter-chip ${aba === 'links' ? 'active' : ''}`} onClick={() => setAba('links')}>
                  Links externos
                </button>
              )}
            </div>

            <div className="panel-body">
              {carregando ? (
                <div className="muted">Carregando...</div>
              ) : aba === 'operadoras' && podeOperadoras ? (
                <>
                  <form className="form-grid" onSubmit={salvarOperadora}>
                    <div className="form-field">
                      <label>Nome</label>
                      <input value={operadoraForm.nome} onChange={e => setOperadoraForm({ ...operadoraForm, nome: e.target.value })} required />
                    </div>
                    <div className="form-field">
                      <label>Ordem</label>
                      <input type="number" value={operadoraForm.ordem} onChange={e => setOperadoraForm({ ...operadoraForm, ordem: e.target.value })} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={operadoraForm.ativo} onChange={e => setOperadoraForm({ ...operadoraForm, ativo: e.target.checked })} />
                      Ativa
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn btn-primary" type="submit">{editandoOperadoraId ? 'Salvar' : 'Adicionar'}</button>
                      {editandoOperadoraId && <button className="btn" type="button" onClick={() => { setEditandoOperadoraId(null); setOperadoraForm(OPERADORA_VAZIA); }}>Cancelar</button>}
                    </div>
                  </form>

                  <div className="list-table">
                    <table>
                      <thead><tr><th>Nome</th><th>Ordem</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {operadoras.map(operadora => (
                          <tr key={operadora.id}>
                            <td>{operadora.nome}</td>
                            <td>{operadora.ordem}</td>
                            <td>{operadora.ativo ? 'Ativa' : 'Inativa'}</td>
                            <td className="row-actions">
                              <button className="btn btn-sm" onClick={() => editarOperadora(operadora)}>Editar</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => removerOperadora(operadora.id)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
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
                      <button className="btn btn-primary" type="submit">{editandoLinkId ? 'Salvar' : 'Adicionar'}</button>
                      {editandoLinkId && <button className="btn" type="button" onClick={() => { setEditandoLinkId(null); setLinkForm(LINK_VAZIO); }}>Cancelar</button>}
                    </div>
                  </form>

                  <div className="list-table">
                    <table>
                      <thead><tr><th>Nome</th><th>URL</th><th>Marcador</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {links.map(link => (
                          <tr key={link.id}>
                            <td>{link.nome}</td>
                            <td className="muted">{link.url}</td>
                            <td>{link.dot}</td>
                            <td>{link.ativo ? 'Ativo' : 'Inativo'}</td>
                            <td className="row-actions">
                              <button className="btn btn-sm" onClick={() => editarLink(link)}>Editar</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => removerLink(link.id)}>Excluir</button>
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
