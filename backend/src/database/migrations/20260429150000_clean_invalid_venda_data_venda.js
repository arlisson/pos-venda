exports.up = function (knex) {
  return knex('vendas')
    .whereRaw("data_venda IS NOT NULL AND data_venda < '1900-01-01'")
    .update({ data_venda: null });
};

exports.down = function () {
  return Promise.resolve();
};
