import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { buscarPerfil, atualizarPerfil } from '../../services/auth.service';

const getInitials = (name) => {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

function EditarPerfilPage() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const perfil = await buscarPerfil();
        setUsuario(perfil);
        setNome(perfil.nome || '');
      } catch (error) {
        setErro(error.message);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const isAdmin = usuario?.role?.nome === 'admin';

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setSalvando(true);
    try {
      const dados = {};
      if (isAdmin) dados.nome = nome;
      if (senha.trim() !== '') dados.senha = senha;

      await atualizarPerfil(dados);
      setSucesso('Alterações salvas com sucesso.');
      setSenha('');
    } catch (error) {
      setErro(error.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando...</div>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Cabeçalho com avatar */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '28px 32px' }}>
            <div className="avatar" style={{ width: 72, height: 72, fontSize: 22, flexShrink: 0 }}>
              {getInitials(usuario?.nome)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{usuario?.nome}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{usuario?.email}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="tag">{usuario?.role?.nome}</span>
                <span className={`pill ${usuario?.ativo ? 'success' : ''}`}>
                  <span className="pill-dot"></span>
                  {usuario?.ativo ? 'Conta ativa' : 'Inativa'}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => navigate('/perfil')}>
              <I.ArrowRight style={{ transform: 'rotate(180deg)' }} size={14} />
              Voltar
            </button>
          </div>
        </div>

        {/* Formulário */}
        <div className="dash-grid" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr' }}>

          {isAdmin && (
            <div className="panel">
              <div className="panel-header">
                <h3>Informações pessoais</h3>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Disponível apenas para administradores</div>
              </div>
              <div className="panel-body">
                <form id="form-nome" onSubmit={handleSubmit}>
                  <div className="form-field">
                    <label>Nome de exibição</label>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                  <div className="form-field" style={{ marginTop: 0 }}>
                    <label>E-mail</label>
                    <input
                      value={usuario?.email}
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>O e-mail não pode ser alterado.</div>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-header">
              <h3>Segurança</h3>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Altere sua senha de acesso</div>
            </div>
            <div className="panel-body">
              <form id="form-senha" onSubmit={handleSubmit}>
                {!isAdmin && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>Nome</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{usuario?.nome}</div>
                  </div>
                )}

                <div className="form-field">
                  <label>Nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(prev => !prev)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', display: 'flex', alignItems: 'center', padding: 0
                      }}
                      tabIndex={-1}
                      title={mostrarSenha ? 'Ocultar senha' : 'Visualizar senha'}
                    >
                      {mostrarSenha ? <I.EyeOff size={15} /> : <I.Eye size={15} />}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Deixe em branco para manter a senha atual.
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Feedback e ações */}
        {(erro || sucesso) && (
          <div style={{ marginTop: 16 }}>
            {erro && <div className="alert-error">{erro}</div>}
            {sucesso && (
              <div style={{ padding: '10px 14px', background: 'var(--success-bg, #f0fdf4)', border: '1px solid var(--success, #22c55e)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--success, #16a34a)' }}>
                {sucesso}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => navigate('/perfil')}>Cancelar</button>
          <button
            type="submit"
            form={isAdmin ? 'form-nome' : 'form-senha'}
            className="btn btn-primary"
            disabled={salvando}
            onClick={handleSubmit}
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    </LayoutPrivado>
  );
}

export default EditarPerfilPage;
