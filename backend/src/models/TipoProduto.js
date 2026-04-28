const { Model } = require('objection');

class TipoProduto extends Model {
  static get tableName() {
    return 'tipos_produto';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = TipoProduto;
