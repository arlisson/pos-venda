import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Botao from '../../components/Botao/Botao';
import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Card from '../../components/Card/Card';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import {
  atualizarUsuario,
  buscarUsuarioPorId,
  listarPermissoes
} from '../../services/usuario.service';

import './EditarUsuarioPage.css';

function EditarUsuarioPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [ativo, setAtivo] = useState(true);

  const [permissoes, setPermissoes] = useState([]);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);

  const [podeGerenciarPermissoes, setPodeGerenciarPermissoes] = useState(false);

  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const isAdminEditado = Number(roleId) === 1;

  useEffect(() => {
    async function carregarDados() {
      try {
        const usuarioLogado = JSON.parse(localStorage.getItem('usuario'));

        const isAdminLogado = usuarioLogado?.role?.nome === 'admin';
        const podeEditarPermissoes =
          isAdminLogado ||
          usuarioLogado?.permissoes?.gerenciar_permissoes === true;

        setPodeGerenciarPermissoes(podeEditarPermissoes);

        const [usuarioData, permissoesData] = await Promise.all([
          buscarUsuarioPorId(id),
          listarPermissoes()
        ]);

        setNome(usuarioData.nome || '');
        setEmail(usuarioData.email || '');
        setRoleId(Number(usuarioData.role_id));
        setAtivo(Boolean(usuarioData.ativo));

        if (podeEditarPermissoes) {
          setPermissoes(permissoesData);
        } else {
          setPermissoes([]);
        }

        const permissoesAtivas = Array.isArray(usuarioData.permissoes)
          ? usuarioData.permissoes
          : Object.entries(usuarioData.permissoes || {})
              .filter(([, permitido]) => permitido)
              .map(([chave]) => chave);

        setPermissoesSelecionadas(permissoesAtivas);
      } catch (error) {
        setErro(error.message);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [id]);

  function handlePermissaoChange(chave) {
    setPermissoesSelecionadas((atuais) => {
      if (atuais.includes(chave)) {
        return atuais.filter((item) => item !== chave);
      }

      return [...atuais, chave];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setErro('');
    setSalvando(true);

    try {
      const dados = {
        nome,
        email,
        role_id: Number(roleId),
        ativo
      };

      if (senha.trim() !== '') {
        dados.senha = senha;
      }

      if (podeGerenciarPermissoes) {
        dados.permissoes = isAdminEditado ? [] : permissoesSelecionadas;
      }

      await atualizarUsuario(id, dados);

      navigate('/usuarios');
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutPrivado>
        <p>Carregando usuário...</p>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <Card>
        <h1 className="editar-usuario__title">Editar usuário</h1>
        <p className="editar-usuario__subtitle">
          Atualize os dados de acesso e permissões do usuário.
        </p>

        {erro && <p className="editar-usuario__error">{erro}</p>}

        <form className="editar-usuario__form" onSubmit={handleSubmit}>
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
            placeholder="Deixe em branco para manter a senha atual"
            onChange={(event) => setSenha(event.target.value)}
          />

          <div className="editar-usuario__field">
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
              <option value={1}>Administrador</option>
              <option value={2}>Usuário comum</option>
            </select>
          </div>

          <label className="editar-usuario__checkbox">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
            />

            <span>Usuário ativo</span>
          </label>

          {isAdminEditado ? (
            <p className="editar-usuario__info">
              Administradores possuem todas as permissões automaticamente.
            </p>
          ) : podeGerenciarPermissoes ? (
            <div className="editar-usuario__permissions">
              <h2>Permissões</h2>

              {permissoes.map((permissao) => (
                <label
                  key={permissao.id}
                  className="editar-usuario__permission"
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
          ) : (
            <p className="editar-usuario__info">
              Você pode editar os dados do usuário, mas não pode alterar permissões.
            </p>
          )}

          <div className="editar-usuario__actions">
            <Botao
              title="Salvar alterações"
              type="submit"
              carregando={salvando}
            />

            <Botao
              title="Cancelar"
              variant="outline"
              onClick={() => navigate('/usuarios')}
            />
          </div>
        </form>
      </Card>
    </LayoutPrivado>
  );
}

export default EditarUsuarioPage;