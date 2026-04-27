import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { criarUsuario, listarPermissoes } from '../../services/usuario.service';
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';
import * as I from '../../components/Icons';

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
  const [carregando, setCarregando] = useState(false);

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
        setPermissoes(permissoesData);
      } catch (error) {
        setErro(error.message || 'Erro ao carregar permissoes.');
      }
    }

    carregarPermissoes();
  }, [podeGerenciarPermissoes]);

  function togglePermissao(chave) {
    setPermissoesSelecionadas(prev =>
      prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
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
      navigate('/usuarios');
    } catch (error) {
      setErro(error.message || 'Erro ao cadastrar usuario.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <LayoutPrivado>
      <div className="users-page" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-icon btn-ghost" onClick={() => navigate('/usuarios')}>
                <I.ArrowRight style={{ transform: 'rotate(180deg)' }} />
              </button>
              Novo Usuario
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
                      <option value={2}>Usuario Comum</option>
                      <option value={1}>Administrador</option>
                    </select>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>
                      Permissoes de acesso
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Number(roleId) === 1 ? (
                        <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)' }}>
                          Administradores possuem todas as permissoes automaticamente.
                        </div>
                      ) : permissoes.length === 0 ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          Nenhuma permissao disponivel.
                        </div>
                      ) : (
                        permissoes.map(p => (
                          <label
                            key={p.chave}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', userSelect: 'none' }}
                          >
                            <input
                              type="checkbox"
                              checked={permissoesSelecionadas.includes(p.chave)}
                              onChange={() => togglePermissao(p.chave)}
                              style={{ marginTop: 3, flexShrink: 0 }}
                            />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                                {p.descricao || 'Permissao do sistema.'}
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-2)', marginTop: 20 }}>
                  Voce pode cadastrar usuarios, mas nao pode definir permissoes.
                </div>
              )}

              {erro && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '16px' }}>{erro}</div>}

              <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => navigate('/usuarios')}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={carregando}>
                  {carregando ? 'Salvando...' : 'Cadastrar Usuario'}
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
