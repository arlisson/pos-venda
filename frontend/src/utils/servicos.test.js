import { describe, expect, it } from 'vitest';
import { agruparOpcoesServicos, formatarNomeServico, servicoIdInclui } from './servicos';

describe('servicos utils', () => {
  it('normaliza e agrupa variacoes de Telefonia movel', () => {
    const opcoes = agruparOpcoesServicos([
      { id: 1, nome: 'Internet' },
      { id: 2, nome: 'Telefonia m?vel' },
      { id: 3, nome: 'Telefonia m\u00f3vel' }
    ]);

    expect(opcoes).toEqual([
      { value: '1', label: 'Internet' },
      { value: '2,3', label: 'Telefonia m\u00f3vel' }
    ]);
    expect(servicoIdInclui('2,3', 2)).toBe(true);
    expect(servicoIdInclui('2,3', 3)).toBe(true);
  });

  it('usa um unico id canonico quando o agrupamento e usado em formulario', () => {
    const opcoes = agruparOpcoesServicos([
      { id: 2, nome: 'Telefonia m?vel' },
      { id: 3, nome: 'Telefonia m\u00f3vel' }
    ], { valueMode: 'canonical' });

    expect(opcoes).toEqual([
      { value: '3', label: 'Telefonia m\u00f3vel' }
    ]);
  });

  it('preserva nomes sem correcao conhecida', () => {
    expect(formatarNomeServico('Telefonia fixa')).toBe('Telefonia fixa');
  });
});
