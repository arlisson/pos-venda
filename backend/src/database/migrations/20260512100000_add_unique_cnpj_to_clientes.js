function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function validarDigitosCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcularDigito = (base) => {
    const pesos = base === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((total, peso, index) => total + Number(cnpj[index]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcularDigito(12) === Number(cnpj[12]) && calcularDigito(13) === Number(cnpj[13]);
}

function validarDigitosCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base) => {
    const soma = Array.from({ length: base }, (_, index) => Number(cpf[index]) * (base + 1 - index))
      .reduce((total, valor) => total + valor, 0);
    const resto = (soma * 10) % 11;
    return resto >= 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function normalizarDocumento(valor) {
  const digitos = somenteDigitos(valor);

  if (digitos.length === 14 && validarDigitosCnpj(digitos)) return digitos;
  if (digitos.length === 11 && validarDigitosCpf(digitos)) return digitos;

  return null;
}

exports.up = async function (knex) {
  const clientes = await knex('clientes')
    .select('id', 'cnpj')
    .whereNotNull('cnpj');

  const documentosPorCliente = clientes
    .map(cliente => ({
      id: cliente.id,
      documento: normalizarDocumento(cliente.cnpj)
    }))
    .filter(cliente => cliente.documento);

  const contagemPorDocumento = documentosPorCliente.reduce((mapa, cliente) => {
    const atual = mapa.get(cliente.documento) || 0;
    mapa.set(cliente.documento, atual + 1);
    return mapa;
  }, new Map());

  const duplicados = Array.from(contagemPorDocumento.entries())
    .filter(([, total]) => total > 1)
    .map(([documento, total]) => ({ documento, total }));

  if (duplicados.length > 0) {
    const lista = duplicados
      .map(item => `${item.documento} (${item.total} registros)`)
      .join(', ');
    throw new Error(`Existem clientes duplicados por CPF/CNPJ valido. Unifique antes de criar o indice unico: ${lista}`);
  }

  const temColuna = await knex.schema.hasColumn('clientes', 'cnpj_digitos');
  if (!temColuna) {
    await knex.schema.alterTable('clientes', function (table) {
      table.string('cnpj_digitos', 14).nullable().after('cnpj');
    });
  }

  await knex('clientes').update({ cnpj_digitos: null });

  for (const cliente of documentosPorCliente) {
    await knex('clientes')
      .where('id', cliente.id)
      .update({ cnpj_digitos: cliente.documento });
  }

  await knex.schema.alterTable('clientes', function (table) {
    table.unique(['cnpj_digitos'], 'clientes_cnpj_digitos_unique');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('clientes', function (table) {
    table.dropUnique(['cnpj_digitos'], 'clientes_cnpj_digitos_unique');
    table.dropColumn('cnpj_digitos');
  });
};
