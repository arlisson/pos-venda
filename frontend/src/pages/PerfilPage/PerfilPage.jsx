import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as I from '../../components/Icons';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { buscarPerfil, logout } from '../../services/auth.service';
import './PerfilPage.css';

const GRUPOS_PERMISSOES = [
  {
    titulo: 'Vendas',
    chaves: ['vendas', 'vendas_ver_proprias', 'vendas_ver_todas', 'vendas_criar', 'vendas_editar', 'vendas_excluir']
  },
  {
    titulo: 'Usuarios',
    chaves: ['crud_usuarios', 'usuarios_listar', 'usuarios_criar', 'usuarios_editar', 'usuarios_excluir', 'gerenciar_permissoes']
  },
  {
    titulo: 'Configuracoes',
    chaves: ['crud_operadoras', 'crud_links']
  }
];

const NOMES_PERMISSOES = {
  vendas: 'Acesso ao modulo',
  vendas_ver_proprias: 'Ver proprias',
  vendas_ver_todas: 'Ver todas',
  vendas_criar: 'Criar',
  vendas_editar: 'Editar',
  vendas_excluir: 'Excluir',
  crud_usuarios: 'Acesso ao modulo',
  usuarios_listar: 'Listar',
  usuarios_criar: 'Criar',
  usuarios_editar: 'Editar',
  usuarios_excluir: 'Excluir',
  gerenciar_permissoes: 'Gerenciar permissoes',
  crud_operadoras: 'Operadoras',
  crud_links: 'Links externos'
};

function montarGruposPermissoes(permissoes = {}) {
  const chavesAgrupadas = new Set(GRUPOS_PERMISSOES.flatMap(grupo => grupo.chaves));
  const grupos = GRUPOS_PERMISSOES.map(grupo => {
    const itens = grupo.chaves
      .filter(chave => Object.prototype.hasOwnProperty.call(permissoes, chave))
      .map(chave => ({
        chave,
        nome: NOMES_PERMISSOES[chave] || chave,
        permitido: permissoes[chave] === true
      }));

    return {
      ...grupo,
      itens,
      liberadas: itens.filter(item => item.permitido).length
    };
  }).filter(grupo => grupo.itens.length > 0);

  const extras = Object.entries(permissoes)
    .filter(([chave]) => !chavesAgrupadas.has(chave))
    .map(([chave, permitido]) => ({
      chave,
      nome: NOMES_PERMISSOES[chave] || chave,
      permitido: permitido === true
    }));

  if (extras.length > 0) {
    grupos.push({
      titulo: 'Outras',
      itens: extras,
      liberadas: extras.filter(item => item.permitido).length
    });
  }

  return grupos;
}

function PerfilPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const data = await buscarPerfil();
        setUsuario(data);
      } catch (error) {
        setErro(error.message);
        logout();
      } finally {
        setCarregando(false);
      }
    }

    carregarPerfil();
  }, []);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const gruposPermissoes = montarGruposPermissoes(usuario?.permissoes);
  const totalPermissoes = gruposPermissoes.reduce((acc, grupo) => acc + grupo.itens.length, 0);
  const totalLiberadas = gruposPermissoes.reduce((acc, grupo) => acc + grupo.liberadas, 0);

  if (carregando) {
    return (
      <LayoutPrivado>
        <div className="empty">Carregando perfil...</div>
      </LayoutPrivado>
    );
  }

  return (
    <LayoutPrivado>
      <div className="users-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
        {erro && <div className="alert-error" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '30px' }}>
            <div className="avatar perfil-avatar">
              {usuario?.foto_perfil ? (
                <img src={usuario.foto_perfil} alt={usuario?.nome || 'Foto de perfil'} />
              ) : (
                getInitials(usuario?.nome)
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{usuario?.nome}</h2>
              <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>{usuario?.email}</div>
              <div style={{ marginTop: '8px' }}>
                <span className="tag">{usuario?.role?.nome}</span>
                <span className={`pill ${usuario?.ativo ? 'success' : ''}`} style={{ marginLeft: '8px' }}>
                  <span className="pill-dot"></span>{usuario?.ativo ? 'Conta Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/perfil/editar')}>
              <I.Edit size={14} /> Editar Perfil
            </button>
          </div>
        </div>

        <div className="dash-grid">
          <div className="panel">
            <div className="panel-header"><h3>Informacoes da Conta</h3></div>
            <div className="panel-body">
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="detail-item">
                  <div className="label">Nome de Exibicao</div>
                  <div className="value">{usuario?.nome}</div>
                </div>
                <div className="detail-item">
                  <div className="label">E-mail de Acesso</div>
                  <div className="value mono">{usuario?.email}</div>
                </div>
                <div className="detail-item">
                  <div className="label">Nivel de Acesso</div>
                  <div className="value">{usuario?.role?.nome}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Permissoes</h3>
                <div className="perfil-permissoes-resumo">
                  {totalLiberadas} de {totalPermissoes} liberadas
                </div>
              </div>
            </div>
            <div className="panel-body">
              {gruposPermissoes.length === 0 ? (
                <div className="muted">Nenhuma permissao especifica.</div>
              ) : (
                <div className="perfil-permissoes">
                  {gruposPermissoes.map(grupo => (
                    <div key={grupo.titulo} className="perfil-permissao-grupo">
                      <div className="perfil-permissao-grupo__top">
                        <span>{grupo.titulo}</span>
                        <span className={`pill ${grupo.liberadas > 0 ? 'success' : 'danger'}`}>
                          <span className="pill-dot"></span>
                          {grupo.liberadas}/{grupo.itens.length}
                        </span>
                      </div>

                      {grupo.liberadas > 0 ? (
                        <div className="perfil-permissao-chips">
                          {grupo.itens.filter(item => item.permitido).map(item => (
                            <span key={item.chave} className="tag">{item.nome}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="perfil-permissao-vazio">Sem acessos liberados</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LayoutPrivado>
  );
}

export default PerfilPage;
