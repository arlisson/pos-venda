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

const GRUPOS_PERMISSOES = [
  {
    id: 'inicio',
    titulo: 'Página inicial',
    descricao: 'Controle os indicadores exibidos no início do sistema.',
    secoes: [
      {
        titulo: 'Cards liberados',
        itens: [
          {
            chave: 'dashboard_resumo_vendas',
            nome: 'Resumo de vendas',
            descricao: 'Mostra os cards Vendas no dia, Valor vendido hoje, Concluídas hoje e Em pipeline.'
          },
          {
            chave: 'campanhas_ver_usuarios',
            nome: 'Campanhas por usuário',
            descricao: 'Mostra no dashboard quem bateu ou ainda não bateu cada campanha.'
          }
        ]
      }
    ]
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios',
    descricao: 'Controle o acesso à página de relatórios comerciais.',
    secoes: [
      {
        titulo: 'Acesso à página',
        itens: [
          {
            chave: 'relatorios_visualizar',
            nome: 'Visualizar relatórios',
            descricao: 'Permite acessar a página Relatórios pela barra lateral.'
          }
        ]
      }
    ]
  },
  {
    id: 'notificacoes',
    titulo: 'Notificações',
    descricao: 'Controle o acesso ao sininho e quem recebe avisos gerais do sistema.',
    secoes: [
      {
        titulo: 'Acesso',
        itens: [
          {
            chave: 'notificacoes_visualizar',
            nome: 'Visualizar notificações',
            descricao: 'Permite abrir o sininho e ver notificações destinadas ao usuário.'
          },
          {
            chave: 'notificacoes_receber_todas',
            nome: 'Receber todas',
            descricao: 'Inclui o usuário como destinatário dos avisos gerais do sistema.'
          }
        ]
      }
    ]
  },
  {
    id: 'vendas',
    titulo: 'Vendas',
    descricao: 'Controle as telas, a visualização e as ações permitidas no módulo de vendas.',
    secoes: [
      {
        titulo: 'Acesso ao módulo',
        itens: [
          {
            chave: 'vendas',
            nome: 'Cadastro de vendas',
            descricao: 'Permite acessar a tela de cadastro e listagem de vendas.'
          }
        ]
      },
      {
        titulo: 'Telas liberadas',
        itens: [
          {
            chave: 'funil_vendas',
            nome: 'Funil de vendas',
            descricao: 'Permite acessar a pagina do funil de vendas.'
          },
          {
            chave: 'crud_funil_etapas',
            nome: 'Gerenciar etapas do funil',
            descricao: 'Permite criar, editar e desativar colunas do funil de vendas.'
          },
          {
            chave: 'pos_venda',
            nome: 'Pós-venda',
            descricao: 'Permite editar vendas enviadas ao pós-venda e movimentar vendas no funil.'
          }
        ]
      },
      {
        titulo: 'Aprovações ADM',
        itens: [
          {
            chave: 'vendas_aprovacoes_visualizar',
            nome: 'Visualizar aprovações',
            descricao: 'Permite acessar a página de solicitações de liberação ADM.'
          },
          {
            chave: 'vendas_aprovacoes_decidir',
            nome: 'Aprovar solicitações',
            descricao: 'Permite aprovar ou recusar liberações de vendas especiais.'
          }
        ]
      },
      {
        titulo: 'Visualização',
        exclusivo: true,
        itens: [
          {
            chave: 'vendas_ver_proprias',
            nome: 'Ver próprias',
            descricao: 'Mostra vendas criadas pelo usuário ou vinculadas a ele.'
          },
          {
            chave: 'vendas_ver_todas',
            nome: 'Ver todas',
            descricao: 'Mostra todas as vendas cadastradas.'
          }
        ]
      },
      {
        titulo: 'Ações',
        itens: [
          {
            chave: 'vendas_criar',
            nome: 'Criar',
            descricao: 'Permite registrar novas vendas.'
          },
          {
            chave: 'vendas_editar',
            nome: 'Editar',
            descricao: 'Permite editar vendas acessíveis.'
          },
          {
            chave: 'vendas_documentos',
            nome: 'Documentos',
            descricao: 'Libera a aba de documentos na visualização da venda.'
          },
          {
            chave: 'vendas_excluir',
            nome: 'Excluir',
            descricao: 'Permite excluir vendas acessíveis.'
          },
          {
            chave: 'vendas_marcar_problema',
            nome: 'Marcar problema',
            descricao: 'Permite abrir solicitacoes urgentes de problema em vendas.'
          }
        ]
      }
    ]
  },
  {
    id: 'usuarios',
    titulo: 'Usuários',
    descricao: 'Controle o acesso ao cadastro de usuários e a administração de permissões.',
    secoes: [
      {
        titulo: 'Acesso ao módulo',
        itens: [
          {
            chave: 'crud_usuarios',
            nome: 'Acesso ao módulo',
            descricao: 'Permite acessar a área de cadastro de usuários.'
          }
        ]
      },
      {
        titulo: 'Ações',
        itens: [
          {
            chave: 'usuarios_listar',
            nome: 'Listar',
            descricao: 'Permite visualizar usuários cadastrados.'
          },
          {
            chave: 'usuarios_criar',
            nome: 'Criar',
            descricao: 'Permite criar novos usuários.'
          },
          {
            chave: 'usuarios_editar',
            nome: 'Editar',
            descricao: 'Permite editar dados de usuários.'
          },
          {
            chave: 'usuarios_excluir',
            nome: 'Excluir',
            descricao: 'Permite excluir usuários comuns.'
          },
          {
            chave: 'gerenciar_permissoes',
            nome: 'Gerenciar permissões',
            descricao: 'Permite atribuir ou remover permissões.'
          }
        ]
      }
    ]
  }
];

function getChavesGrupo(grupo) {
  return Array.from(new Set(grupo.secoes.flatMap(secao => secao.itens.map(item => item.chave))));
}

function getPermissoesDeclaradas() {
  return GRUPOS_PERMISSOES.flatMap(grupo => (
    grupo.secoes.flatMap(secao => (
      secao.itens.map(item => ({
        chave: item.chave,
        nome: item.nome,
        descricao: item.descricao
      }))
    ))
  ));
}

function PermissaoCard({ item, selecionado, exclusivo, grupoExclusivo, onToggle }) {
  return (
    <label className={`permissions-option ${selecionado ? 'is-active' : ''} ${exclusivo ? 'permissions-option--exclusive' : ''}`}>
      <input
        type="checkbox"
        checked={selecionado}
        onChange={() => onToggle(item.chave, exclusivo ? { grupoExclusivo } : undefined)}
      />
      <span>
        <strong>{item.nome}</strong>
        <small>{item.descricao || 'Permissão do sistema.'}</small>
      </span>
    </label>
  );
}

function PermissaoGrupoSemantico({ grupo, selecionadas, onToggle }) {
  const chaves = getChavesGrupo(grupo);
  const selecionadasNoGrupo = chaves.filter(chave => selecionadas.includes(chave)).length;
  const ativo = selecionadasNoGrupo > 0;

  return (
    <section className={`permissions-group permissions-group--semantic ${ativo ? 'is-active' : ''}`}>
      <div className="permissions-group__header">
        <div>
          <h4>{grupo.titulo}</h4>
          <p>{grupo.descricao}</p>
        </div>

        <span className={`pill ${ativo ? 'success' : 'danger'}`}>
          <span className="pill-dot"></span>
          {selecionadasNoGrupo}/{chaves.length}
        </span>
      </div>

      <div className="permissions-sections">
        {grupo.secoes.map(secao => {
          const grupoExclusivo = secao.itens.map(item => item.chave);

          return (
            <div key={secao.titulo} className="permissions-section">
              <div className="permissions-section__title">{secao.titulo}</div>
              <div className={`permissions-options ${secao.exclusivo ? 'permissions-options--exclusive' : ''}`}>
                {secao.itens.map(item => (
                  <PermissaoCard
                    key={item.chave}
                    item={item}
                    selecionado={selecionadas.includes(item.chave)}
                    exclusivo={secao.exclusivo}
                    grupoExclusivo={grupoExclusivo}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
        setErro('Erro ao carregar permissões do usuário.');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [usuarioId]);

  function toggle(chave, opcoes = {}) {
    setSelecionadas(prev => {
      const selecionada = prev.includes(chave);

      if (opcoes.grupoExclusivo) {
        const semGrupo = prev.filter(item => !opcoes.grupoExclusivo.includes(item));
        return selecionada ? semGrupo : [...semGrupo, chave];
      }

      return selecionada ? prev.filter(c => c !== chave) : [...prev, chave];
    });
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
  const permissoesPorChave = [...permissoes, ...getPermissoesDeclaradas()].reduce((acc, permissao) => {
    acc[permissao.chave] = permissao;
    return acc;
  }, {});
  const gruposSemanticos = GRUPOS_PERMISSOES.map(grupo => ({
    ...grupo,
    secoes: grupo.secoes
      .map(secao => ({
        ...secao,
        itens: secao.itens
          .filter(item => permissoesPorChave[item.chave])
          .map(item => ({
            ...item,
            descricao: item.descricao || permissoesPorChave[item.chave]?.descricao
          }))
      }))
      .filter(secao => secao.itens.length > 0)
  })).filter(grupo => grupo.secoes.length > 0);
  const permissoesAgrupadas = new Set(gruposSemanticos.flatMap(getChavesGrupo));
  const permissoesRestantes = permissoes
    .filter(permissao => !permissoesAgrupadas.has(permissao.chave))
    .map(permissao => ({
      chave: permissao.chave,
      nome: permissao.nome,
      descricao: permissao.descricao
    }));
  const grupoOutrasPermissoes = permissoesRestantes.length > 0
    ? {
        id: 'outras',
        titulo: 'Outras permissões',
        descricao: 'Permissões adicionais do sistema que não fazem parte dos grupos principais.',
        secoes: [
          {
            titulo: 'Permissões',
            itens: permissoesRestantes
          }
        ]
      }
    : null;
  const totalSelecionadas = selecionadas.length;

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
              <div className="permissions-grid">
                {gruposSemanticos.map(grupo => (
                  <PermissaoGrupoSemantico
                    key={grupo.id}
                    grupo={grupo}
                    selecionadas={selecionadas}
                    onToggle={toggle}
                  />
                ))}

                {grupoOutrasPermissoes && (
                  <PermissaoGrupoSemantico
                    grupo={grupoOutrasPermissoes}
                    selecionadas={selecionadas}
                    onToggle={toggle}
                  />
                )}
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
            <button className="btn btn-primary" onClick={() => navigate('/usuarios/novo')}>
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
                            <button className="btn btn-icon btn-ghost" title="Editar" onClick={() => navigate(`/usuarios/${u.id}/editar`)}>
                              <I.Edit size={13} />
                            </button>
                          )}

                          {podeGerenciarPermissoes && (
                            <button className="btn btn-sm btn-ghost" onClick={() => setGerenciandoId(u.id)}>
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
                            <button className="btn btn-icon btn-ghost" title="Excluir" onClick={() => handleDelete(u)}>
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

