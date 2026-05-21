export function formatarNomeServico(nome) {
  const texto = String(nome || '').trim();
  if (!texto) return '';

  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    normalizado === 'telefonia movel'
    || /^telefonia m.vel$/i.test(texto)
    || texto === 'Telefonia m\u00c3\u00b3vel'
  ) {
    return 'Telefonia m\u00f3vel';
  }

  return texto;
}

export function normalizarNomeServicoParaFiltro(nome) {
  return formatarNomeServico(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escolherServicoCanonico(servicos = []) {
  return servicos.find(servico => String(servico?.nome || '').trim() === 'Telefonia m\u00f3vel')
    || servicos[0];
}

export function agruparOpcoesServicos(servicos = [], opcoes = {}) {
  const valueMode = opcoes.valueMode || 'all';
  const grupos = new Map();

  servicos.forEach(servico => {
    const label = formatarNomeServico(servico?.nome);
    const chave = normalizarNomeServicoParaFiltro(label);
    const id = servico?.id != null ? String(servico.id) : '';

    if (!chave || !id) return;

    if (!grupos.has(chave)) {
      grupos.set(chave, { ids: [], itens: [], label });
    }

    const grupo = grupos.get(chave);
    grupo.itens.push(servico);
    if (!grupo.ids.includes(id)) {
      grupo.ids.push(id);
    }
  });

  return Array.from(grupos.values()).map(grupo => {
    const canonico = escolherServicoCanonico(grupo.itens);

    return {
      value: valueMode === 'canonical' ? String(canonico?.id || grupo.ids[0]) : grupo.ids.join(','),
      label: grupo.label
    };
  });
}

export function servicoIdInclui(filtro, servicoId) {
  if (!filtro || servicoId == null) return false;
  return String(filtro)
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .includes(String(servicoId));
}
