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
import {
  garantirPermissaoPosVenda as garantirPermissaoPosVendaCompartilhada,
  montarGruposPermissoes as montarGruposPermissoesCompartilhados,
  PermissaoGrupo as PermissaoGrupoCompartilhado
} from './permissoes';
import './Usuarios.css';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;
  if (typeof permissoes === 'string') {
    try { return JSON.parse(permissoes); } catch { return []; }
  }
  return Object.entries(permissoes).filter(([, v]) => v).map(([k]) => k);
}

function ModalPermissoes({ usuarioId, usuarios, onClose, onSave }) {
  const [usuario, setUsuario] = useState(null);
  const [permissoes, setPermissoes] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [usuarioOrigemId, setUsuarioOrigemId] = useState('');
  const [avisoCopia, setAvisoCopia] = useState('');
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
        setPermissoes(garantirPermissaoPosVendaCompartilhada(permissoesData));
        setSelecionadas(parsePermissoes(usuarioData.permissoes));
      } catch {
        setErro('Erro ao carregar permissões do usuário.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [usuarioId]);

  function toggle(chave, opcoes = {}) {
    setAvisoCopia('');
    setSelecionadas(prev => {
      const selecionada = prev.includes(chave);

      if (opcoes.grupoExclusivo) {
        const semGrupo = prev.filter(item => !opcoes.grupoExclusivo.includes(item));
        return selecionada ? semGrupo : [...semGrupo, chave];
      }

      return selecionada ? prev.filter(c => c !== chave) : [...prev, chave];
    });
  }

  function getPermissoesCopiaveis(usuarioOrigem) {
    const chavesDisponiveis = permissoes.map(permissao => permissao.chave);

    if (usuarioOrigem?.role?.nome === 'admin') {
      return chavesDisponiveis;
    }

    const chavesOrigem = new Set(parsePermissoes(usuarioOrigem?.permissoes));
    return chavesDisponiveis.filter(chave => chavesOrigem.has(chave));
  }

  function copiarPermissoes() {
    const usuarioOrigem = usuarios.find(item => String(item.id) === String(usuarioOrigemId));

    if (!usuarioOrigem) {
      setAvisoCopia('');
      return;
    }

    const proximasPermissoes = getPermissoesCopiaveis(usuarioOrigem);
    setSelecionadas(proximasPermissoes);
    setAvisoCopia(`Permissões de ${usuarioOrigem.nome} copiadas. Revise e salve para aplicar.`);
  }

  async function handleSave() {
    setSalvando(true);
    setErro('');

    try {
      await onSave(usuarioId, selecionadas);
      onClose();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar permissões.');
      setSalvando(false);
    }
  }

  const isAdmin = usuario?.role?.nome === 'admin';
  const gruposPermissoesCompartilhados = montarGruposPermissoesCompartilhados(permissoes);
  const totalSelecionadas = selecionadas.length;
  const usuariosOrigem = usuarios.filter(item => Number(item.id) !== Number(usuarioId));

  return (
    <div
      className="permissions-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel permissions-modal">
        <div className="panel-header permissions-modal__header">
          <div>
            <h3 style={{ margin: 0 }}>Gerenciar permissões</h3>
            {usuario && (
              <div className="permissions-modal__sub">
                {usuario.nome} · {totalSelecionadas} permissões selecionadas
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
              Administradores possuem todas as permissões automaticamente.
            </div>
          ) : (
            <>
              <div className="permissions-copy">
                <div className="permissions-copy__field">
                  <label>Copiar permissões de</label>
                  <select value={usuarioOrigemId} onChange={event => setUsuarioOrigemId(event.target.value)}>
                    <option value="">Selecione um usuário</option>
                    {usuariosOrigem.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nome} - {item.role?.nome || 'Sem perfil'}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn" type="button" onClick={copiarPermissoes} disabled={!usuarioOrigemId}>
                  <I.Users size={14} /> Copiar
                </button>
              </div>

              {avisoCopia && <div className="permissions-copy__notice">{avisoCopia}</div>}

              <div className="permissions-grid">
                {gruposPermissoesCompartilhados.map(grupo => (
                  <PermissaoGrupoCompartilhado
                    key={grupo.id}
                    grupo={grupo}
                    selecionadas={selecionadas}
                    onToggle={toggle}
                  />
                ))}

              </div>

              {erro && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{erro}</div>}

              <div className="permissions-modal__footer">
                <button className="btn" onClick={onClose}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar permissões'}
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
  const [sucesso, setSucesso] = useState('');
  const [deletando, setDeletando] = useState(null);
  const [gerenciandoId, setGerenciandoId] = useState(null);
  const navigate = useNavigate();

  const usuarioLogado = getUsuarioLocal();
  const podeGerenciarPermissoes = temPermissao(usuarioLogado, 'gerenciar_permissoes');
  const podeCriarUsuarios = temPermissao(usuarioLogado, 'usuarios_criar');
  const podeEditarUsuarios = temPermissao(usuarioLogado, 'usuarios_editar');
  const podeExcluirUsuarios = temPermissao(usuarioLogado, 'usuarios_excluir');
  const usuarioLogadoEhAdmin = usuarioLogado?.role?.nome === 'admin';
  const podeMostrarAcoesUsuarios = podeEditarUsuarios || podeGerenciarPermissoes || podeExcluirUsuarios;

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

  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const dados = await listarUsuarios();
        setUsuarios(dados);
      } catch {
        setErro('Erro ao carregar usuários.');
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
        setSucesso('Usuário excluído com sucesso.');
      } catch (error) {
        setErro(error.message || 'Erro ao excluir usuário.');
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

    if (Number(usuarioLogado?.id) === Number(id)) {
      localStorage.setItem('usuario', JSON.stringify({
        ...usuarioLogado,
        permissoes: permissoesSelecionadas
      }));
    }

    setSucesso('Permissões atualizadas com sucesso.');
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
          usuarios={usuarios}
          onClose={() => setGerenciandoId(null)}
          onSave={handleSavePermissoes}
        />
      )}

      <div className="users-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {usuarios.length} usuários · {usuarios.filter(u => u.ativo).length} ativos
          </div>
          {podeCriarUsuarios && (
            <button className="btn btn-primary users-add-btn" onClick={() => navigate('/usuarios/novo')}>
              <I.Plus size={14} /> Adicionar usuário
            </button>
          )}
        </div>

        {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginBottom: 16 }}>{sucesso}</div>}
        {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  {podeMostrarAcoesUsuarios && <th></th>}
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={podeMostrarAcoesUsuarios ? 5 : 4} style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={podeMostrarAcoesUsuarios ? 5 : 4} style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Nenhum usuário encontrado.
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
                      {podeMostrarAcoesUsuarios && (
                        <td className="row-actions">
                          {podeEditarUsuarios && (
                            <button className="btn btn-icon btn-ghost users-edit-btn" title="Editar" onClick={() => navigate(`/usuarios/${u.id}/editar`)}>
                              <I.Edit size={13} />
                            </button>
                          )}

                          {podeGerenciarPermissoes && (
                            <button className="btn btn-sm btn-ghost users-permissions-btn" onClick={() => setGerenciandoId(u.id)}>
                              Gerenciar permissões
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
<<<<<<< HEAD
                            <button className="btn btn-icon btn-ghost users-delete-btn" title="Excluir" onClick={() => handleDelete(u)}>
=======
                            <button className="btn btn-icon btn-ghost btn-danger-icon" title="Excluir" onClick={() => handleDelete(u)}>
>>>>>>> 59ac04e9a2feb461ed45717914f22cf78cb22c0f
                              <I.Trash size={13} />
                            </button>
                          ) : null}
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

export default Usuarios;

