const { Model } = require('objection');

class Servico extends Model {
  static get tableName() {
    return 'servicos';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Servico;
