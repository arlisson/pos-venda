const { Model } = require('objection');

class RegraComissao extends Model {
  static get tableName() {
    return 'regras_comissao';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = RegraComissao;
