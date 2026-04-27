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
import { getUsuarioLocal, temPermissao } from '../../services/auth.service';

import './EditarUsuarioPage.css';

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;
  if (typeof permissoes === 'string') {
    try { return JSON.parse(permissoes); } catch { return []; }
  }
  return Object.entries(permissoes).filter(([, permitido]) => permitido).map(([chave]) => chave);
}

function EditarUsuarioPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [roleIdOriginal, setRoleIdOriginal] = useState(2);
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
        const usuarioLogado = getUsuarioLocal();
        const podeEditarPermissoes = temPermissao(usuarioLogado, 'gerenciar_permissoes');

        setPodeGerenciarPermissoes(podeEditarPermissoes);

        const usuarioPromise = buscarUsuarioPorId(id);
        const permissoesPromise = podeEditarPermissoes ? listarPermissoes() : Promise.resolve([]);
        const [usuarioData, permissoesData] = await Promise.all([usuarioPromise, permissoesPromise]);

        const roleAtual = Number(usuarioData.role_id);

        setNome(usuarioData.nome || '');
        setEmail(usuarioData.email || '');
        setRoleId(roleAtual);
        setRoleIdOriginal(roleAtual);
        setAtivo(Boolean(usuarioData.ativo));
        setPermissoes(permissoesData);
        setPermissoesSelecionadas(parsePermissoes(usuarioData.permissoes));
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
        ativo
      };

      if (senha.trim() !== '') {
        dados.senha = senha;
      }

      if (podeGerenciarPermissoes) {
        dados.role_id = Number(roleId);
        dados.permissoes = isAdminEditado ? [] : permissoesSelecionadas;
      } else {
        dados.role_id = roleIdOriginal;
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
        <p>Carregando usuario...</p>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <Card>
        <h1 className="editar-usuario__title">Editar usuario</h1>
        <p className="editar-usuario__subtitle">
          Atualize os dados de acesso do usuario.
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

          {podeGerenciarPermissoes ? (
            <div className="editar-usuario__field">
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
                <option value={1}>Administrador</option>
                <option value={2}>Usuario comum</option>
              </select>
            </div>
          ) : (
            <p className="editar-usuario__info">
              Voce pode editar os dados do usuario, mas nao pode alterar funcao ou permissoes.
            </p>
          )}

          <label className="editar-usuario__checkbox">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
            />

            <span>Usuario ativo</span>
          </label>

          {podeGerenciarPermissoes && (
            isAdminEditado ? (
              <p className="editar-usuario__info">
                Administradores possuem todas as permissoes automaticamente.
              </p>
            ) : (
              <div className="editar-usuario__permissions">
                <h2>Permissoes</h2>

                {permissoes.map((permissao) => (
                  <label
                    title={permissao.descricao || permissao.nome}
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
            )
          )}

          <div className="editar-usuario__actions">
            <Botao
              title="Salvar alteracoes"
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
