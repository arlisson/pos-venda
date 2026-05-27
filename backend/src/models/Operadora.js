const { Model } = require('objection');

/**
 * Modelo Objection para operadoras cadastradas.
 */
class Operadora extends Model {
  static get tableName() {
    return 'operadoras';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Operadora;
