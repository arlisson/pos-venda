import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CampoTexto from './CampoTexto';

describe('CampoTexto', () => {
  it('renderiza label, valor, placeholder e atributos basicos', () => {
    render(
      <CampoTexto
        label="Email"
        type="email"
        name="email"
        value="teste@email.com"
        placeholder="email@empresa.com"
        onChange={vi.fn()}
        required
      />
    );

    const input = screen.getByDisplayValue('teste@email.com');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveValue('teste@email.com');
    expect(input).toHaveAttribute('placeholder', 'email@empresa.com');
    expect(input).toBeRequired();
  });

  it('chama onChange ao editar', () => {
    const onChange = vi.fn();
    render(<CampoTexto label="Nome" value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ana' } });

    expect(onChange).toHaveBeenCalled();
  });
});
