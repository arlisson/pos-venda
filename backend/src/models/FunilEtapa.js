const { Model } = require('objection');

/**
 * Modelo Objection para as etapas configuraveis do funil de vendas.
 */
class FunilEtapa extends Model {
  static get tableName() {
    return 'funil_etapas';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = FunilEtapa;
