import Label from '../Label/Label';
import './CampoTexto.css';

function CampoTexto({
  label,
  type = 'text',
  name,
  value,
  placeholder,
  onChange,
  required = false
}) {
  return (
    <div className="campo-texto">
      {label && <Label>{label}</Label>}

      <input
        className="campo-texto__input"
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}

export default CampoTexto;