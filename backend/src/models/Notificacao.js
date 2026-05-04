const { Model } = require('objection');

class Notificacao extends Model {
  static get tableName() {
    return 'notificacoes';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Notificacao;
