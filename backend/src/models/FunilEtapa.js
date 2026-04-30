const { Model } = require('objection');

class FunilEtapa extends Model {
  static get tableName() {
    return 'funil_etapas';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = FunilEtapa;
