import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Botao from '../../components/Botao/Botao';
import Card from '../../components/Card/Card';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import { listarPermissoes, criarUsuario } from '../../services/usuario.service';

import './CadastroUsuario.css';

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
        const podeGerenciarPermissoes =
          usuario?.permissoes?.gerenciar_permissoes === true;

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
        permissoes: roleId === 1 ? [] : permissoesSelecionadas
      });

      navigate('/usuarios');
    } catch (error) {
      setErro(error.message);
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
      <Card>
        <h1 className="titulo">Cadastro de Usuário</h1>

        {erro && <p className="erro">{erro}</p>}

        <form onSubmit={handleSubmit}>
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
            label="Senha"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />

          <div className="role">
            <label htmlFor="role">Função</label>

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

          {roleId === 1 ? (
            <p className="cadastro-usuario__info">
              Administradores possuem todas as permissões automaticamente.
            </p>
          ) : (
            <div className="permissoes">
              <label>Permissões</label>

              {permissoes.map((permissao) => (
                <div key={permissao.id}>
                  <input
                    type="checkbox"
                    id={permissao.chave}
                    value={permissao.chave}
                    checked={permissoesSelecionadas.includes(permissao.chave)}
                    onChange={() => handlePermissaoChange(permissao.chave)}
                  />

                  <label htmlFor={permissao.chave}>
                    {permissao.nome}
                  </label>
                </div>
              ))}
            </div>
          )}

          <Botao
            title="Cadastrar"
            type="submit"
            carregando={carregando}
          />
        </form>
      </Card>
    </LayoutPrivado>
  );
}

export default CadastroUsuario;