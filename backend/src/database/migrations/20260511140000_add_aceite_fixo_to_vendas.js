exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.string('dia_aceite_fixo', 20).nullable();
    table.string('horario_aceite_fixo', 10).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('dia_aceite_fixo');
    table.dropColumn('horario_aceite_fixo');
  });
};
