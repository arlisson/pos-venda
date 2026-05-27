const { Model } = require('objection');

/**
 * Modelo Objection para tipos de venda.
 */
class TipoVenda extends Model {
  static get tableName() {
    return 'tipos_venda';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = TipoVenda;
