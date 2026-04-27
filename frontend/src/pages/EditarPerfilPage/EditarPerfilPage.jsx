import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Botao from '../../components/Botao/Botao';
import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Card from '../../components/Card/Card';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import { atualizarPerfil, buscarPerfil } from '../../services/auth.service';
import { listarPermissoes } from '../../services/usuario.service';

import './EditarPerfilPage.css';

function EditarPerfilPage() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [permissoes, setPermissoes] = useState([]);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);

  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const isAdmin = usuario?.role?.nome === 'admin';

  useEffect(() => {
    async function carregarDados() {
      try {
        const perfil = await buscarPerfil();

        setUsuario(perfil);
        setNome(perfil.nome || '');
        setEmail(perfil.email || '');

        const permissoesAtivas = Object.entries(perfil.permissoes || {})
          .filter(([, permitido]) => permitido)
          .map(([chave]) => chave);

        setPermissoesSelecionadas(permissoesAtivas);

        if (perfil.role?.nome === 'admin') {
          const todasPermissoes = await listarPermissoes();
          setPermissoes(todasPermissoes);
        }
      } catch (error) {
        setErro(error.message);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, []);

  function handlePermissaoChange(chave) {
    setPermissoesSelecionadas((permissoesAtuais) => {
      if (permissoesAtuais.includes(chave)) {
        return permissoesAtuais.filter((item) => item !== chave);
      }

      return [...permissoesAtuais, chave];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setErro('');
    setSalvando(true);

    try {
      const dados = {
        nome,
        email
      };

      if (senha.trim() !== '') {
        dados.senha = senha;
      }

      if (isAdmin) {
        dados.permissoes = permissoesSelecionadas;
      }

      await atualizarPerfil(dados);

      navigate('/perfil');
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutPrivado>
        <p>Carregando...</p>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <Card>
        <h1 className="editar-perfil__title">Editar perfil</h1>
        <p className="editar-perfil__subtitle">
          Atualize seus dados de acesso.
        </p>

        {erro && <p className="editar-perfil__error">{erro}</p>}

        <form className="editar-perfil__form" onSubmit={handleSubmit}>
          <CampoTexto
            label="Nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
          />

          <CampoTexto
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <CampoTexto
            label="Nova senha"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            placeholder="Deixe em branco para manter a senha atual"
          />

          {isAdmin && (
            <div className="editar-perfil__permissions">
              <h2>Permissões</h2>

              {permissoes.map((permissao) => (
                <label
                  key={permissao.id}
                  className="editar-perfil__permission"
                >
                  <input
                    type="checkbox"
                    checked={permissoesSelecionadas.includes(permissao.chave)}
                    onChange={() => handlePermissaoChange(permissao.chave)}
                  />

                  <span>{permissao.nome}</span>
                </label>
              ))}
            </div>
          )}

          {!isAdmin && (
            <p className="editar-perfil__info">
              Usuários comuns não podem alterar permissões.
            </p>
          )}

          <div className="editar-perfil__actions">
            <Botao
              title="Salvar alterações"
              type="submit"
              carregando={salvando}
            />

            <Botao
              title="Cancelar"
              variant="outline"
              onClick={() => navigate('/perfil')}
            />
          </div>
        </form>
      </Card>
    </LayoutPrivado>
  );
}

export default EditarPerfilPage;