exports.up = function (knex) {
  return knex('clientes')
    .whereRaw("fidelidade_fim IS NOT NULL AND fidelidade_fim < '1900-01-01'")
    .update({ fidelidade_fim: null });
};

exports.down = function () {
  return Promise.resolve();
};
