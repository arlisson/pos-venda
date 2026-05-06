import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/auth.service';

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(email, senha);
      navigate('/');
    } catch (error) {
      setErro(error.message || 'E-mail ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">SISTEMA POS-VENDA</div>
        <h1>Entrar no sistema</h1>
        <p className="sub">Acesse com sua conta da empresa</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>E-mail</label>
            <input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="form-field">
            <label>Senha</label>
            <input 
              type="password" 
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              placeholder="••••••••"
              required
            />
          </div>

          {erro && (
            <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '12px' }}>
              {erro}
            </div>
          )}

          <div className="row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
              <input type="checkbox" defaultChecked /> Manter conectado
            </label>
            <a href="#" style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>Esqueci minha senha</a>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            disabled={carregando}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>
          v1.0 · Sistema interno · Acesso restrito
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
