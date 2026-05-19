import './Botao.css';

function Botao({
  title,
  type = 'button',
  variant = 'primary',
  carregando = false,
  disabled = false,
  onClick
}) {
  return (
    <button
      type={type}
      className={`botao botao--${variant}`}
      disabled={disabled || carregando}
      onClick={onClick}
    >
      {carregando ? 'Carregando...' : title}
    </button>
  );
}

export default Botao;