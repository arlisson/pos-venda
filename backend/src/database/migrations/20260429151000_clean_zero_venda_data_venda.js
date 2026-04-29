exports.up = function (knex) {
  return knex('vendas')
    .whereRaw("CAST(data_venda AS CHAR) = '0000-00-00'")
    .orWhere('data_venda', '1899-11-30')
    .update({ data_venda: null });
};

exports.down = function () {
  return Promise.resolve();
};
