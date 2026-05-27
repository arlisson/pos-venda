const { Model } = require('objection');

/**
 * Modelo Objection para tipos de produto.
 */
class TipoProduto extends Model {
  static get tableName() {
    return 'tipos_produto';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = TipoProduto;
