import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Botao from '../../components/Botao/Botao';
import LayoutPrivado from '../../layouts/LayoutPrivado/LayoutPrivado';
import { listarUsuarios } from '../../services/usuario.service';

import './Usuarios.css';

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function carregarUsuarios() {
      try {
        const dadosUsuarios = await listarUsuarios();
        setUsuarios(dadosUsuarios);
      } catch (error) {
        setErro('Erro ao carregar usuários.');
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuarios();
  }, []);

  return (
    <LayoutPrivado>
      <h1>Lista de Usuários</h1>

      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table className="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nome}</td>
                <td>{usuario.email}</td>
                <td>{usuario.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <Botao
                    title="Editar"
                    variant="outline"
                    onClick={() => navigate(`/usuarios/${usuario.id}/editar`)}
                  />
                  <Botao title="Excluir" variant="danger" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </LayoutPrivado>
  );
}

export default Usuarios;