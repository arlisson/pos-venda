import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { criarUsuario, listarPermissoes } from '../../services/usuario.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import * as I from '../../components/Icons';
import '../Usuarios/Usuarios.css';

const PERMISSAO_POS_VENDA = {
  chave: 'pos_venda',
  nome: 'Pós-venda',
  descricao: 'Permite editar vendas enviadas ao pós-venda e movimentar vendas no funil.'
};

function garantirPermissaoPosVenda(permissoes = []) {
  if (permissoes.some(permissao => permissao.chave === PERMISSAO_POS_VENDA.chave)) {
    return permissoes;
  }

  return [...permissoes, PERMISSAO_POS_VENDA];
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
            descricao: 'Permite acessar a página do funil de vendas.'
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
            descricao: 'Permite abrir solicitações urgentes de problema em vendas.'
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

function montarGruposPermissoes(permissoes = []) {
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

  return permissoesRestantes.length > 0
    ? [
        ...gruposSemanticos,
        {
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
      ]
    : gruposSemanticos;
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

function PermissaoGrupo({ grupo, selecionadas, onToggle }) {
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

function CadastroUsuario() {
  const navigate = useNavigate();

  const usuarioLogado = getUsuarioLocal();
  const podeGerenciarPermissoes = temPermissao(usuarioLogado, 'gerenciar_permissoes');

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [permissoes, setPermissoes] = useState([]);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

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
    async function carregarPermissoes() {
      if (!podeGerenciarPermissoes) {
        setPermissoes([]);
        setPermissoesSelecionadas([]);
        setRoleId(2);
        return;
      }

      try {
        const permissoesData = await listarPermissoes();
        setPermissoes(garantirPermissaoPosVenda(permissoesData));
      } catch (error) {
        setErro(error.message || 'Erro ao carregar permissões.');
      }
    }

    carregarPermissoes();
  }, [podeGerenciarPermissoes]);

  function togglePermissao(chave, opcoes = {}) {
    setPermissoesSelecionadas(prev => {
      const selecionada = prev.includes(chave);

      if (opcoes.grupoExclusivo) {
        const semGrupo = prev.filter(item => !opcoes.grupoExclusivo.includes(item));
        return selecionada ? semGrupo : [...semGrupo, chave];
      }

      return selecionada ? prev.filter(c => c !== chave) : [...prev, chave];
    });
  }

  const gruposPermissoes = useMemo(() => montarGruposPermissoes(permissoes), [permissoes]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);

    try {
      const dados = {
        nome,
        email,
        senha,
        role_id: podeGerenciarPermissoes ? Number(roleId) : 2
      };

      if (podeGerenciarPermissoes) {
        dados.permissoes = Number(roleId) === 1 ? [] : permissoesSelecionadas;
      }

      await criarUsuario(dados);
      setSucesso('Usuário cadastrado com sucesso. Redirecionando...');
      setTimeout(() => navigate('/usuarios'), 800);
    } catch (error) {
      setErro(error.message || 'Erro ao cadastrar usuário.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <LayoutPrivado>
      <div className="users-page" style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-icon btn-ghost" onClick={() => navigate('/usuarios')}>
                <I.ArrowRight style={{ transform: 'rotate(180deg)' }} />
              </button>
              Novo Usuário
            </h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label>Nome Completo</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Joao Silva"
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@empresa.com"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Senha</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="********"
                    required
                  />
                </div>
              </div>

              {podeGerenciarPermissoes ? (
                <>
                  <div className="form-field">
                    <label htmlFor="role">Funcao</label>
                    <select
                      id="role"
                      value={roleId}
                      onChange={(event) => {
                        const novaRoleId = Number(event.target.value);
                        setRoleId(novaRoleId);

                        if (novaRoleId === 1) {
                          setPermissoesSelecionadas([]);
                        }
                      }}
                    >
                      <option value={2}>Usuário Comum</option>
                      <option value={1}>Administrador</option>
                    </select>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>
                      Permissoes de acesso
                    </div>
                    <div className="permissions-grid">
                      {Number(roleId) === 1 ? (
                        <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)' }}>
                          Administradores possuem todas as permissões automaticamente.
                        </div>
                      ) : permissoes.length === 0 ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          Nenhuma permissão disponível.
                        </div>
                      ) : (
                        gruposPermissoes.map(grupo => (
                          <PermissaoGrupo
                            key={grupo.id}
                            grupo={grupo}
                            selecionadas={permissoesSelecionadas}
                            onToggle={togglePermissao}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', marginTop: 20 }}>
                  Você pode cadastrar usuários, mas não pode definir permissões.
                </div>
              )}

              {sucesso && <div className="alert-success alert-timed alert-timed--success" style={{ marginTop: 16 }}>{sucesso}</div>}
              {erro && <div className="alert-error alert-timed alert-timed--error" style={{ marginTop: 16 }}>{erro}</div>}

              <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => navigate('/usuarios')}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={carregando}>
                  {carregando ? 'Salvando...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default CadastroUsuario;
