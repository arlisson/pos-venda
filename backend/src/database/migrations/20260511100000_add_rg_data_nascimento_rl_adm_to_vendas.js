exports.up = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.string('rg_representante_legal', 40).nullable();
    table.date('data_nascimento_representante_legal').nullable();
    table.string('rg_administrador', 40).nullable();
    table.date('data_nascimento_administrador').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('vendas', (table) => {
    table.dropColumn('rg_representante_legal');
    table.dropColumn('data_nascimento_representante_legal');
    table.dropColumn('rg_administrador');
    table.dropColumn('data_nascimento_administrador');
  });
};
