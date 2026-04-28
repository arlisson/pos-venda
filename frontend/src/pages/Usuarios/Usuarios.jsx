import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import {
  listarUsuarios,
  deletarUsuario,
  atualizarUsuario,
  buscarUsuarioPorId,
  listarPermissoes
} from '../../services/usuario.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import './Usuarios.css';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;
  if (typeof permissoes === 'string') {
    try { return JSON.parse(permissoes); } catch { return []; }
  }
  return Object.entries(permissoes).filter(([, v]) => v).map(([k]) => k);
}

const SUBPERMISSOES = {
  vendas: ['vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir'],
  crud_usuarios: ['usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir']
};

function PermissaoGrupo({ permissao, filhas, selecionadas, onToggle }) {
  const totalFilhas = filhas.length;
  const filhasSelecionadas = filhas.filter(filha => selecionadas.includes(filha.chave)).length;
  const moduloSelecionado = selecionadas.includes(permissao.chave);

  return (
    <section className={`permissions-group ${moduloSelecionado || filhasSelecionadas > 0 ? 'is-active' : ''}`}>
      <div className="permissions-group__header">
        <label className="permissions-module">
          <input
            type="checkbox"
            checked={moduloSelecionado}
            onChange={() => onToggle(permissao.chave)}
          />
          <span>
            <strong>{permissao.nome}</strong>
            <small>{permissao.descricao || 'Permissao do sistema.'}</small>
          </span>
        </label>

        <span className={`pill ${moduloSelecionado || filhasSelecionadas > 0 ? 'success' : 'danger'}`}>
          <span className="pill-dot"></span>
          {totalFilhas > 0 ? `${filhasSelecionadas}/${totalFilhas}` : moduloSelecionado ? 'Liberado' : 'Bloqueado'}
        </span>
      </div>

      {totalFilhas > 0 && (
        <div className="permissions-actions">
          {filhas.map(filha => (
            <label key={filha.chave} className={`permissions-action ${selecionadas.includes(filha.chave) ? 'is-active' : ''}`}>
              <input
                type="checkbox"
                checked={selecionadas.includes(filha.chave)}
                onChange={() => onToggle(filha.chave)}
              />
              <span>
                <strong>{filha.nome.replace(`${permissao.nome}:`, '').trim()}</strong>
                <small>{filha.descricao}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function ModalPermissoes({ usuarioId, onClose, onSave }) {
  const [usuario, setUsuario] = useState(null);
  const [permissoes, setPermissoes] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const [usuarioData, permissoesData] = await Promise.all([
          buscarUsuarioPorId(usuarioId),
          listarPermissoes()
        ]);

        setUsuario(usuarioData);
        setPermissoes(permissoesData);
        setSelecionadas(parsePermissoes(usuarioData.permissoes));
      } catch {
        setErro('Erro ao carregar permissoes do usuario.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [usuarioId]);

  function toggle(chave) {
    setSelecionadas(prev =>
      prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]
    );
  }

  async function handleSave() {
    setSalvando(true);
    setErro('');

    try {
      await onSave(usuarioId, selecionadas);
      onClose();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar permissoes.');
      setSalvando(false);
    }
  }

  const isAdmin = usuario?.role?.nome === 'admin';
  const permissoesFilhas = new Set(Object.values(SUBPERMISSOES).flat());
  const permissoesPorChave = permissoes.reduce((acc, permissao) => {
    acc[permissao.chave] = permissao;
    return acc;
  }, {});
  const permissoesPrincipais = permissoes.filter(p => !permissoesFilhas.has(p.chave));
  const totalSelecionadas = selecionadas.length;

  return (
    <div
      className="permissions-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel permissions-modal">
        <div className="panel-header permissions-modal__header">
          <div>
            <h3 style={{ margin: 0 }}>Gerenciar permissoes</h3>
            {usuario && (
              <div className="permissions-modal__sub">
                {usuario.nome} · {totalSelecionadas} permissoes selecionadas
              </div>
            )}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <I.Close size={14} />
          </button>
        </div>

        <div className="panel-body permissions-modal__body">
          {carregando ? (
            <div className="muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: 13 }}>
              Carregando...
            </div>
          ) : erro && !usuario ? (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>{erro}</div>
          ) : isAdmin ? (
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)' }}>
              Administradores possuem todas as permissoes automaticamente.
            </div>
          ) : (
            <>
              <div className="permissions-grid">
                {permissoesPrincipais.map(p => (
                  <PermissaoGrupo
                    key={p.chave}
                    permissao={p}
                    filhas={(SUBPERMISSOES[p.chave] || [])
                      .map(chaveFilha => permissoesPorChave[chaveFilha])
                      .filter(Boolean)}
                    selecionadas={selecionadas}
                    onToggle={toggle}
                  />
                ))}
              </div>

              {erro && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{erro}</div>}

              <div className="permissions-modal__footer">
                <button className="btn" onClick={onClose}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar permissoes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [deletando, setDeletando] = useState(null);
  const [gerenciandoId, setGerenciandoId] = useState(null);
  const navigate = useNavigate();

  const usuarioLogado = getUsuarioLocal();
  const podeGerenciarPermissoes = temPermissao(usuarioLogado, 'gerenciar_permissoes');
  const podeCriarUsuarios = temPermissao(usuarioLogado, 'usuarios_criar');
  const podeEditarUsuarios = temPermissao(usuarioLogado, 'usuarios_editar');
  const podeExcluirUsuarios = temPermissao(usuarioLogado, 'usuarios_excluir');
  const usuarioLogadoEhAdmin = usuarioLogado?.role?.nome === 'admin';

  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const dados = await listarUsuarios();
        setUsuarios(dados);
      } catch {
        setErro('Erro ao carregar usuarios.');
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuarios();
  }, []);

  async function handleDelete(u) {
    if (deletando === u.id) {
      try {
        await deletarUsuario(u.id);
        setUsuarios(prev => prev.filter(x => x.id !== u.id));
      } catch (error) {
        setErro(error.message || 'Erro ao excluir usuario.');
      } finally {
        setDeletando(null);
      }
    } else {
      setDeletando(u.id);
    }
  }

  async function handleSavePermissoes(id, permissoesSelecionadas) {
    await atualizarUsuario(id, { permissoes: permissoesSelecionadas });
    setUsuarios(prev =>
      prev.map(u => u.id === id ? { ...u, permissoes: permissoesSelecionadas } : u)
    );
  }

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <LayoutPrivado>
      {gerenciandoId !== null && (
        <ModalPermissoes
          usuarioId={gerenciandoId}
          onClose={() => setGerenciandoId(null)}
          onSave={handleSavePermissoes}
        />
      )}

      <div className="users-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {usuarios.length} usuarios · {usuarios.filter(u => u.ativo).length} ativos
          </div>
          {podeCriarUsuarios && (
            <button className="btn btn-primary" onClick={() => navigate('/usuarios/novo')}>
              <I.Plus size={14} /> Adicionar usuario
            </button>
          )}
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Carregando usuarios...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11, overflow: 'hidden' }}>
                            {u.foto_perfil ? (
                              <img
                                src={u.foto_perfil}
                                alt={u.nome || 'Foto de perfil'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              getInitials(u.nome)
                            )}
                          </span>
                          <span style={{ fontWeight: 500 }}>{u.nome}</span>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td><span className="tag">{u.role?.nome || 'Nenhum'}</span></td>
                      <td>
                        <span className={`pill ${u.ativo ? 'success' : ''}`}>
                          <span className="pill-dot"></span>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="row-actions">
                        {podeEditarUsuarios && (
                          <button className="btn btn-icon btn-ghost" title="Editar" onClick={() => navigate(`/usuarios/${u.id}/editar`)}>
                            <I.Edit size={13} />
                          </button>
                        )}

                        {podeGerenciarPermissoes && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setGerenciandoId(u.id)}>
                            Gerenciar permissoes
                          </button>
                        )}

                        {podeExcluirUsuarios && Number(usuarioLogado?.id) !== Number(u.id) && (usuarioLogadoEhAdmin || u.role?.nome !== 'admin') && deletando === u.id ? (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: 11 }}
                              onClick={() => handleDelete(u)}
                            >
                              Confirmar
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setDeletando(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : podeExcluirUsuarios && Number(usuarioLogado?.id) !== Number(u.id) && (usuarioLogadoEhAdmin || u.role?.nome !== 'admin') ? (
                          <button className="btn btn-icon btn-ghost" title="Excluir" onClick={() => handleDelete(u)}>
                            <I.Trash size={13} />
                          </button>
                        ) : null}
                      </td>
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

export default Usuarios;
