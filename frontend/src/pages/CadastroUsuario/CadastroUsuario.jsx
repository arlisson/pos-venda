import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { criarUsuario } from '../../services/usuario.service';
import { getUsuarioLocal } from '../../services/auth.service';
import * as I from '../../components/Icons';

const PERMISSOES = [
  { chave: 'vendas', nome: 'Vendas', desc: 'Permite acessar a área de vendas.' },
  { chave: 'crud_usuarios', nome: 'Cadastro de usuários', desc: 'Permite criar, editar, listar e desativar usuários.' },
  { chave: 'gerenciar_permissoes', nome: 'Gerenciar permissões', desc: 'Permite atribuir e remover permissões dos usuários.' },
];

function CadastroUsuario() {
  const navigate = useNavigate();

  const usuarioLogado = getUsuarioLocal();
  const podeGerenciarPermissoes =
    usuarioLogado?.role?.nome === 'admin' ||
    usuarioLogado?.permissoes?.gerenciar_permissoes === true;

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

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
      await criarUsuario({ nome, email, senha, role_id: 2, permissoes: permissoesSelecionadas });
      navigate('/usuarios');
    } catch (error) {
      setErro(error.message || 'Erro ao cadastrar usuário.');
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
                  placeholder="Ex: João Silva"
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
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {podeGerenciarPermissoes && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 8 }}>
                    Permissões de acesso
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PERMISSOES.map(p => (
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
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{p.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {erro && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '16px' }}>{erro}</div>}

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
