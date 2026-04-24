import { Link } from 'react-router-dom';
import Botao from '../Botao/Botao';
import './Navbar.css';

function Navbar({ usuario, onLogout }) {
  const temPermissaoCrudUsuarios = usuario?.role?.permissoes?.crud_usuarios;

  return (
    <header className="navbar">
      <div>
        <strong className="navbar__logo">Pós-venda</strong>
      </div>

      <nav className="navbar__content">
        {usuario && (
          <span className="navbar__user">
            {usuario.nome}
          </span>
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