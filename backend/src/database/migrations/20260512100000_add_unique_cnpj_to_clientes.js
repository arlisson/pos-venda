function cnpjDigitsSql() {
  return "REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')";
}

exports.up = async function (knex) {
  const digits = cnpjDigitsSql();

  const duplicados = await knex('clientes')
    .select(knex.raw(`${digits} as cnpj_digitos`))
    .count({ total: 'id' })
    .whereNotNull('cnpj')
    .whereRaw("TRIM(cnpj) <> ''")
    .whereRaw(`CHAR_LENGTH(${digits}) = 14`)
    .groupByRaw(digits)
    .havingRaw('COUNT(id) > 1');

  if (duplicados.length > 0) {
    const lista = duplicados
      .map(item => `${item.cnpj_digitos} (${item.total} registros)`)
      .join(', ');
    throw new Error(`Existem clientes duplicados por CNPJ. Unifique antes de criar o indice unico: ${lista}`);
  }

  await knex.schema.alterTable('clientes', function (table) {
    table.string('cnpj_digitos', 14).nullable().after('cnpj');
  });

  await knex.raw(`
    UPDATE clientes
    SET cnpj_digitos = CASE
      WHEN cnpj IS NULL OR TRIM(cnpj) = '' THEN NULL
      WHEN CHAR_LENGTH(${digits}) = 14 THEN ${digits}
      ELSE NULL
    END
  `);

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
