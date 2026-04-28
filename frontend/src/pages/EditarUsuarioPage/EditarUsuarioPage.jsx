import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Botao from '../../components/Botao/Botao';
import CampoTexto from '../../components/CampoTexto/CampoTexto';
import Card from '../../components/Card/Card';
import * as I from '../../components/Icons';
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
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [dadosOriginais, setDadosOriginais] = useState(null);

  const isAdminEditado = Number(roleId) === 1;
  const iniciaisUsuario = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase() || 'U';

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

        const nomeVal = usuarioData.nome || '';
        const emailVal = usuarioData.email || '';
        const ativoVal = Boolean(usuarioData.ativo);
        const permissoesSelecionadasParsed = parsePermissoes(usuarioData.permissoes);

        const originais = {
          nome: nomeVal,
          email: emailVal,
          roleId: roleAtual,
          ativo: ativoVal,
          permissoes: [...permissoesSelecionadasParsed]
        };

        setNome(nomeVal);
        setEmail(emailVal);
        setRoleId(roleAtual);
        setRoleIdOriginal(roleAtual);
        setAtivo(ativoVal);
        setPermissoes(permissoesData);
        setPermissoesSelecionadas(permissoesSelecionadasParsed);
        setDadosOriginais(originais);
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

  // Calcula as mudancas sem causar re-renders
  const mudancas = useMemo(() => {
    if (!dadosOriginais) return {};

    const m = {};

    if (nome !== dadosOriginais.nome) m.nome = true;
    if (email !== dadosOriginais.email) m.email = true;
    if (ativo !== dadosOriginais.ativo) m.ativo = true;
    if (senha.trim() !== '') m.senha = true;

    if (podeGerenciarPermissoes) {
      if (Number(roleId) !== dadosOriginais.roleId) m.roleId = true;
      if (!isAdminEditado) {
        const permissoesOriginais = new Set(dadosOriginais.permissoes);
        const permissoesAtuais = new Set(permissoesSelecionadas);
        if (permissoesOriginais.size !== permissoesAtuais.size ||
            [...permissoesOriginais].some(p => !permissoesAtuais.has(p))) {
          m.permissoes = true;
        }
      }
    }

    return m;
  }, [nome, email, ativo, senha, roleId, permissoesSelecionadas, dadosOriginais, podeGerenciarPermissoes, isAdminEditado]);

  const temMudancas = Object.keys(mudancas).length > 0;
  const totalMudancas = Object.keys(mudancas).length;
  const totalPermissoesSelecionadas = isAdminEditado
    ? permissoes.length
    : permissoesSelecionadas.length;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!temMudancas) {
      setErro('Nenhuma alteracao foi feita.');
      return;
    }

    setErro('');
    setSucesso('');
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

      setSucesso('Usuario atualizado com sucesso!');
      setSenha('');
      setDadosOriginais({
        nome,
        email,
        roleId: Number(roleId),
        ativo,
        permissoes: isAdminEditado ? [] : [...permissoesSelecionadas]
      });

      setTimeout(() => setSucesso(''), 5000);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <LayoutPrivado>
        <div className="editar-usuario-page">
          <Card className="editar-usuario-card">
            <div className="editar-usuario__loading">Carregando usuario...</div>
          </Card>
        </div>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <div className="editar-usuario-page">
        <Card className="editar-usuario-card">
        <div className="editar-usuario__header">
          <div className="editar-usuario__identity">
            <button
              type="button"
              className="btn btn-icon btn-ghost editar-usuario__back"
              onClick={() => navigate('/usuarios')}
              aria-label="Voltar para usuarios"
              title="Voltar"
            >
              <I.ArrowRight style={{ transform: 'rotate(180deg)' }} />
            </button>

            <div className="editar-usuario__avatar">{iniciaisUsuario}</div>

            <div>
              <h1 className="editar-usuario__title">Editar usuario</h1>
              <p className="editar-usuario__subtitle">
                Atualize dados de acesso, status e permissoes.
              </p>
            </div>
          </div>

          <div className="editar-usuario__summary">
            <span className={`pill ${ativo ? 'success' : 'danger'}`}>
              <span className="pill-dot"></span>
              {ativo ? 'Ativo' : 'Inativo'}
            </span>
            <span className="pill">
              <I.Shield size={13} />
              {Number(roleId) === 1 ? 'Administrador' : 'Usuario comum'}
            </span>
            {temMudancas && (
              <span className="pill warn">
                <span className="pill-dot"></span>
                {totalMudancas} alteracao{totalMudancas > 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>

        {erro && <div className="editar-usuario__message editar-usuario__message--error">{erro}</div>}

        {sucesso && (
          <div className="editar-usuario__message editar-usuario__message--success">
            <I.Check className="editar-usuario__message-icon" size={15} />
            {sucesso}
          </div>
        )}

        {temMudancas && !erro && !sucesso && (
          <div className="editar-usuario__changes-indicator">
            <span className="editar-usuario__changes-dot"></span>
            Alteracoes nao salvas
          </div>
        )}

        <form className="editar-usuario__form" onSubmit={handleSubmit}>
          <section className="editar-usuario__section">
            <div className="editar-usuario__section-header">
              <div>
                <h2>Dados do usuario</h2>
                <p>Informacoes usadas para identificacao e login.</p>
              </div>
            </div>

            <div className="editar-usuario__form-grid">
              <div className={`editar-usuario__field-wrapper ${mudancas.nome ? 'modified' : ''}`}>
                <CampoTexto
                  label="Nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  required
                />
                {mudancas.nome && <span className="editar-usuario__field-modified">modificado</span>}
              </div>

              <div className={`editar-usuario__field-wrapper ${mudancas.email ? 'modified' : ''}`}>
                <CampoTexto
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                {mudancas.email && <span className="editar-usuario__field-modified">modificado</span>}
              </div>

              <div className={`editar-usuario__field-wrapper editar-usuario__field-wrapper--full ${mudancas.senha ? 'modified' : ''}`}>
                <CampoTexto
                  label="Nova senha"
                  type="password"
                  value={senha}
                  placeholder="Deixe em branco para manter a senha atual"
                  onChange={(event) => setSenha(event.target.value)}
                />
                {mudancas.senha && <span className="editar-usuario__field-modified">modificado</span>}
              </div>
            </div>
          </section>

          <section className="editar-usuario__section">
            <div className="editar-usuario__section-header">
              <div>
                <h2>Acesso</h2>
                <p>Controle funcao e disponibilidade da conta.</p>
              </div>
            </div>

            <div className="editar-usuario__access-grid">
          {podeGerenciarPermissoes ? (
            <div className={`editar-usuario__field ${mudancas.roleId ? 'modified' : ''}`}>
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
              {mudancas.roleId && <span className="editar-usuario__field-modified">modificado</span>}
            </div>
          ) : (
            <p className="editar-usuario__info">
              Voce pode editar os dados do usuario, mas nao pode alterar funcao ou permissoes.
            </p>
          )}

              <div className={`editar-usuario__status-card ${ativo ? 'is-active' : 'is-inactive'} ${mudancas.ativo ? 'modified' : ''}`}>
                <label className="editar-usuario__checkbox editar-usuario__status-toggle">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(event) => setAtivo(event.target.checked)}
                  />

                  <span className="editar-usuario__switch" aria-hidden="true"></span>
                  <span>
                    <strong>Usuario ativo</strong>
                    <small>{ativo ? 'Pode acessar o sistema.' : 'Acesso bloqueado.'}</small>
                  </span>
                </label>
                {mudancas.ativo && <span className="editar-usuario__field-modified">modificado</span>}
              </div>
            </div>
          </section>

          {podeGerenciarPermissoes && (
            isAdminEditado ? (
              <section className="editar-usuario__section">
                <p className="editar-usuario__info">
                  Administradores possuem todas as permissoes automaticamente.
                </p>
              </section>
            ) : (
              <section className="editar-usuario__section editar-usuario__permissions">
                <div className="editar-usuario__section-header">
                  <div>
                    <h2>Permissoes</h2>
                    <p>Selecione quais areas e acoes este usuario pode acessar.</p>
                  </div>

                  <span className="editar-usuario__permissions-count">
                    {totalPermissoesSelecionadas} de {permissoes.length}
                  </span>
                </div>

                <div className="editar-usuario__permissions-grid">
                  {permissoes.map((permissao) => (
                    <label
                      title={permissao.descricao || permissao.nome}
                      key={permissao.id}
                      className={`editar-usuario__permission ${permissoesSelecionadas.includes(permissao.chave) ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={permissoesSelecionadas.includes(permissao.chave)}
                        onChange={() => handlePermissaoChange(permissao.chave)}
                      />

                      <span>{permissao.nome}</span>
                      {permissao.descricao && <small>{permissao.descricao}</small>}
                    </label>
                  ))}
                </div>
              </section>
            )
          )}

          <div className="editar-usuario__actions">
            <Botao
              title={salvando ? 'Salvando...' : 'Salvar alteracoes'}
              type="submit"
              carregando={salvando}
              disabled={!temMudancas}
            />

            <Botao
              title="Cancelar"
              variant="outline"
              onClick={() => navigate('/usuarios')}
            />
          </div>
        </form>
        </Card>
      </div>
    </LayoutPrivado>
  );
}

export default EditarUsuarioPage;
