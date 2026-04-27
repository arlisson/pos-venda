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
  const [roleId, setRoleId] = useState(2); // usuário comum por padrão
  const [permissoes, setPermissoes] = useState([]);
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Verifica se é admin
  const [todasPermissoes, setTodasPermissoes] = useState([]);

  useEffect(() => {
    // Verifica se o usuário tem permissão de admin
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    setIsAdmin(usuario?.role?.nome === 'admin');

    // Carrega as permissões
    async function carregarPermissoes() {
      try {
        // Log para verificar se estamos carregando as permissões corretamente
        // console.log('Carregando permissões...');

        const permissoesData = await listarPermissoes(); // Chama a função para carregar as permissões
        // console.log('Permissões carregadas:', permissoesData);  // Log para ver o que está sendo retornado da API

        setTodasPermissoes(permissoesData); // Atualiza o estado com todas as permissões

        if (usuario?.role?.nome !== 'admin') {
          // Usuário comum não pode editar todas as permissões
          const permissoesIniciais = permissoesData.filter(p => p.chave === 'vendas'); // Filtra apenas permissões relacionadas a "vendas"
          setPermissoes(permissoesIniciais); // Atualiza o estado para um conjunto restrito de permissões
        } else {
          setPermissoes(permissoesData);  // Caso seja admin, mantém todas as permissões
        }
      } catch (err) {
        // console.error('Erro ao carregar permissões:', err); // Log para capturar o erro
        setErro('Erro ao carregar permissões'); // Exibe uma mensagem de erro no frontend
      }
    }

    carregarPermissoes();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErro('');
    setCarregando(true);

    try {
      await criarUsuario({
        nome,
        email,
        senha,
        role_id: roleId,
        permissoes: permissoesSelecionadas
      });
      navigate('/perfil');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  };

  const handlePermissaoChange = (permissaoChave) => {
    setPermissoesSelecionadas((prevState) => {
      if (prevState.includes(permissaoChave)) {
        return prevState.filter((item) => item !== permissaoChave);
      } else {
        return [...prevState, permissaoChave];
      }
    });
  };

  return (
    <LayoutPrivado>
      <Card>
        <h1 className="titulo">Cadastro de Usuário</h1>

        {erro && <p className="erro">{erro}</p>}

        <form onSubmit={handleSubmit}>
          <CampoTexto
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <CampoTexto
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <CampoTexto
            label="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <div className="role">
            <label htmlFor="role">Função</label>
            <select
              id="role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value={2}>Usuário Comum</option>
              <option value={1}>Administrador</option>
            </select>
          </div>

          <div className="permissoes">
            <label>Permissões</label>
            {permissoes.map((permissao) => (
              <div key={permissao.id}>
                <input
                  type="checkbox"
                  id={permissao.chave}
                  value={permissao.chave}
                  onChange={() => handlePermissaoChange(permissao.chave)}
                  disabled={roleId === '2' && !permissoesSelecionadas.includes(permissao.chave)} // Admin pode editar todas
                />
                <label htmlFor={permissao.chave}>{permissao.nome}</label>
              </div>
            ))}
          </div>

          <Botao title="Cadastrar" type="submit" carregando={carregando} />
        </form>
      </Card>
    </LayoutPrivado>
  );
}

export default CadastroUsuario;