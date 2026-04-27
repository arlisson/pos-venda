import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Botao from '../../components/Botao/Botao';
import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Card from '../../components/Card/Card';

import { login } from '../../services/auth.service';

import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@empresa.com');
  const [senha, setSenha] = useState('admin123');
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
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="login-page">
      <Card className="login-page__card">
        <h1 className="login-page__title">Pós-venda</h1>
        <p className="login-page__subtitle">
          Acesse sua conta para continuar.
        </p>

        <form className="login-page__form" onSubmit={handleSubmit}>
          <CampoTexto
            label="E-mail"
            type="email"
            value={email}
            placeholder="seu@email.com"
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <CampoTexto
            label="Senha"
            type="password"
            value={senha}
            placeholder="Digite sua senha"
            onChange={(event) => setSenha(event.target.value)}
            required
          />

          {erro && (
            <p className="login-page__error">
              {erro}
            </p>
          )}

          <Botao
            title="Entrar"
            type="submit"
            carregando={carregando}
          />
        </form>
      </Card>
    </main>
  );
}

export default LoginPage;