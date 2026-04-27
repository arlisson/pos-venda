import { Link } from 'react-router-dom';
import Botao from '../Botao/Botao';
import './Navbar.css';

function Navbar({ usuario, onLogout }) {
  const temPermissaoCrudUsuarios = usuario?.permissoes?.crud_usuarios;

  return (
    <header className="navbar">
      <div>
        <Link to="/" className="navbar__logo">
          Pós-venda
        </Link>
      </div>

      <nav className="navbar__content">
        {usuario && (
          <Link to="/perfil" className="navbar__user">
            {usuario.nome}
          </Link>
        )}

        {temPermissaoCrudUsuarios && (
          <div className="navbar__links">
            <Link to="/usuarios/cadastrar">Cadastrar Usuário</Link>
            <Link to="/usuarios">Listar Usuários</Link>
          </div>
        )}

        {onLogout && (
          <Botao
            title="Sair"
            variant="danger"
            onClick={onLogout}
          />
        )}
      </nav>
    </header>
  );
}

export default Navbar;