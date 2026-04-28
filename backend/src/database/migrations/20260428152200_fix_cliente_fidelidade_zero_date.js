exports.up = function (knex) {
  return knex('clientes')
    .where('fidelidade_fim', '1899-11-30')
    .update({ fidelidade_fim: null });
};

exports.down = function () {
  return Promise.resolve();
};
