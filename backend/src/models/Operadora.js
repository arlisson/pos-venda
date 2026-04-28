const { Model } = require('objection');

class Operadora extends Model {
  static get tableName() {
    return 'operadoras';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Operadora;
