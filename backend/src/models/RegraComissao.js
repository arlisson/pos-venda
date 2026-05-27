const { Model } = require('objection');

/**
 * Modelo Objection para regras de comissao por operadora e servico.
 */
class RegraComissao extends Model {
  static get tableName() {
    return 'regras_comissao';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = RegraComissao;
