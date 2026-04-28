const { Model } = require('objection');

class TipoVenda extends Model {
  static get tableName() {
    return 'tipos_venda';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = TipoVenda;
