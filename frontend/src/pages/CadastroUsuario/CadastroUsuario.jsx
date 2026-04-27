import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarPermissoes, criarUsuario } from '../../services/usuario.service';
import * as I from '../../components/Icons';

function CadastroUsuario() {
  const navigate = useNavigate();

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
      try {
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        const permissoesData = await listarPermissoes();

        const isAdmin = usuario?.role?.nome === 'admin';
        const podeGerenciarPermissoes = usuario?.permissoes?.gerenciar_permissoes === true;

        if (isAdmin || podeGerenciarPermissoes) {
          setPermissoes(permissoesData);
        } else {
          setPermissoes([]);
        }
      } catch (err) {
        setErro('Erro ao carregar permissões');
      }
    }

    carregarPermissoes();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await criarUsuario({
        nome,
        email,
        senha,
        role_id: Number(roleId),
        permissoes: roleId === 1 ? [] : permissoesSelecionadas,
      });
      navigate('/usuarios');
    } catch (error) {
      setErro(error.message || 'Erro ao cadastrar usuário.');
    } finally {
      setCarregando(false);
    }
  }

  function handlePermissaoChange(permissaoChave) {
    setPermissoesSelecionadas((permissoesAtuais) => {
      if (permissoesAtuais.includes(permissaoChave)) {
        return permissoesAtuais.filter((item) => item !== permissaoChave);
      }
      return [...permissoesAtuais, permissaoChave];
    });
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

              <div className="form-field">
                <label>Perfil / Função</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
                >
                  <option value={2}>Vendedor (Usuário Comum)</option>
                  <option value={1}>Administrador</option>
                  <option value={3}>Pós-venda</option>
                </select>
              </div>

              {roleId !== 1 && permissoes.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-2)', display: 'block', marginBottom: '10px' }}>
                    Permissões de Acesso
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {permissoes.map((permissao) => (
                      <label key={permissao.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={permissoesSelecionadas.includes(permissao.chave)}
                          onChange={() => handlePermissaoChange(permissao.chave)}
                        />
                        {permissao.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {roleId === 1 && (
                <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-2)' }}>
                  Administradores possuem todas as permissões automaticamente.
                </div>
              )}

              {erro && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '16px' }}>{erro}</div>}

              <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
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
