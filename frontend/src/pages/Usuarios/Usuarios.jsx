import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarUsuarios, deletarUsuario, atualizarUsuario, buscarUsuarioPorId } from '../../services/usuario.service';
import { getUsuarioLocal } from '../../services/auth.service';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;
  if (typeof permissoes === 'string') {
    try { return JSON.parse(permissoes); } catch { return []; }
  }
  return Object.entries(permissoes).filter(([, v]) => v).map(([k]) => k);
}

const PERMISSOES = [
  { chave: 'vendas', nome: 'Vendas', desc: 'Permite acessar a área de vendas.' },
  { chave: 'crud_usuarios', nome: 'Cadastro de usuários', desc: 'Permite criar, editar, listar e desativar usuários.' },
  { chave: 'gerenciar_permissoes', nome: 'Gerenciar permissões', desc: 'Permite atribuir e remover permissões dos usuários.' },
];

function ModalPermissoes({ usuarioId, onClose, onSave }) {
  const [usuario, setUsuario] = useState(null);
  const [selecionadas, setSelecionadas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const data = await buscarUsuarioPorId(usuarioId);
        setUsuario(data);
        setSelecionadas(parsePermissoes(data.permissoes));
      } catch (error) {
        setErro('Erro ao carregar permissões do usuário.');
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
      setErro(error.message || 'Erro ao salvar permissões.');
      setSalvando(false);
    }
  }

  const isAdmin = usuario?.role?.nome === 'admin';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel" style={{ width: 440, margin: 0, boxShadow: 'var(--shadow-md)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Gerenciar permissões</h3>
            {usuario && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{usuario.nome}</div>}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <I.Close size={14} />
          </button>
        </div>

        <div className="panel-body">
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PERMISSOES.map(p => (
                  <label
                    key={p.chave}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', userSelect: 'none' }}
                  >
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(p.chave)}
                      onChange={() => toggle(p.chave)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{p.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {erro && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{erro}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
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
  const [deletando, setDeletando] = useState(null);
  const [gerenciandoId, setGerenciandoId] = useState(null);
  const navigate = useNavigate();

  const usuarioLogado = getUsuarioLocal();
  const podeGerenciarPermissoes =
    usuarioLogado?.role?.nome === 'admin' ||
    usuarioLogado?.permissoes?.gerenciar_permissoes === true;

  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const dados = await listarUsuarios();
        setUsuarios(dados);
      } catch (error) {
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
            {usuarios.length} usuários · {usuarios.filter(u => u.ativo).length} ativos
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/usuarios/novo')}>
            <I.Plus size={14} /> Adicionar usuário
          </button>
        </div>

        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="list-table" style={{ margin: 0 }}>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
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
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }} className="muted">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                            {getInitials(u.nome)}
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
                        <button className="btn btn-icon btn-ghost" title="Editar" onClick={() => navigate(`/usuarios/${u.id}/editar`)}>
                          <I.Edit size={13} />
                        </button>

                        {podeGerenciarPermissoes && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setGerenciandoId(u.id)}>
                            Gerenciar permissões
                          </button>
                        )}

                        {deletando === u.id ? (
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
                        ) : (
                          <button className="btn btn-icon btn-ghost" title="Excluir" onClick={() => handleDelete(u)}>
                            <I.Trash size={13} />
                          </button>
                        )}
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
