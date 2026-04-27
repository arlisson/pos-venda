import { useEffect, useState } from 'react';

import Botao from '../../components/Botao/Botao';
import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Card from '../../components/Card/Card';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';

import { atualizarPerfil, buscarPerfil, logout } from '../../services/auth.service';
import { listarPermissoes } from '../../services/usuario.service';

import './PerfilPage.css';

function PerfilPage() {
  const [usuario, setUsuario] = useState(null);
  const [editando, setEditando] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [permissoes, setPermissoes] = useState([]);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const isAdmin = usuario?.role?.nome === 'admin';

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    try {
      const data = await buscarPerfil();
      const todasPermissoes = await listarPermissoes();

      setUsuario(data);
      setNome(data.nome || '');
      setEmail(data.email || '');
      setPermissoes(todasPermissoes);

      const permissoesAtivas = Object.entries(data.permissoes || {})
        .filter(([, permitido]) => permitido)
        .map(([chave]) => chave);

      setPermissoesSelecionadas(permissoesAtivas);
    } catch (error) {
      setErro(error.message);
      logout();
    } finally {
      setCarregando(false);
    }
  }

  function obterNomePermissao(chave) {
    const permissao = permissoes.find((item) => item.chave === chave);

    return permissao?.nome || chave;
  }

  function handlePermissaoChange(chave) {
    setPermissoesSelecionadas((atuais) => {
      if (atuais.includes(chave)) {
        return atuais.filter((item) => item !== chave);
      }

      return [...atuais, chave];
    });
  }

  function cancelarEdicao() {
    setEditando(false);
    setSenha('');
    setErro('');

    if (usuario) {
      setNome(usuario.nome || '');
      setEmail(usuario.email || '');

      const permissoesAtivas = Object.entries(usuario.permissoes || {})
        .filter(([, permitido]) => permitido)
        .map(([chave]) => chave);

      setPermissoesSelecionadas(permissoesAtivas);
    }
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

      const usuarioAtualizado = await atualizarPerfil(dados);

      setUsuario(usuarioAtualizado);
      setSenha('');
      setEditando(false);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutPrivado>
        <p>Carregando perfil...</p>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <Card>
        <div className="perfil-page__header">
          <div>
            <h1 className="perfil-page__title">Meu perfil</h1>
            <p className="perfil-page__subtitle">
              Dados do usuário autenticado.
            </p>
          </div>

          {!editando && (
            <Botao
              title="Editar"
              variant="outline"
              onClick={() => setEditando(true)}
            />
          )}
        </div>

        {erro && <p className="perfil-page__error">{erro}</p>}

        {!editando ? (
          <>
            <div className="perfil-page__grid">
              <div className="perfil-page__info">
                <span>Nome</span>
                <strong>{usuario.nome}</strong>
              </div>

              <div className="perfil-page__info">
                <span>E-mail</span>
                <strong>{usuario.email}</strong>
              </div>

              <div className="perfil-page__info">
                <span>Status</span>
                <strong>{usuario.ativo ? 'Ativo' : 'Inativo'}</strong>
              </div>

              <div className="perfil-page__info">
                <span>Role</span>
                <strong>{usuario.role?.nome}</strong>
              </div>
            </div>

            <h2 className="perfil-page__section-title">Permissões</h2>

            <div className="perfil-page__permissions">
              {Object.entries(usuario.permissoes || {}).map(([modulo, permitido]) => (
                <div className="perfil-page__permission" key={modulo}>
                  <span>{obterNomePermissao(modulo)}</span>

                  <strong className={permitido ? 'is-allowed' : 'is-denied'}>
                    {permitido ? 'Permitido' : 'Bloqueado'}
                  </strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <form className="perfil-page__form" onSubmit={handleSubmit}>
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

            {isAdmin ? (
              <div className="perfil-page__permissions-edit">
                <h2 className="perfil-page__section-title">Permissões</h2>

                {permissoes.map((permissao) => (
                  <label
                    key={permissao.id}
                    className="perfil-page__permission-checkbox"
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
              <p className="perfil-page__info-text">
                Usuários comuns não podem alterar permissões.
              </p>
            )}

            <div className="perfil-page__actions">
              <Botao
                title="Salvar"
                type="submit"
                carregando={salvando}
              />

              <Botao
                title="Cancelar"
                variant="outline"
                onClick={cancelarEdicao}
              />
            </div>
          </form>
        )}
      </Card>
    </LayoutPrivado>
  );
}

export default PerfilPage;