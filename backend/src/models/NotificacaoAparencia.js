const { Model } = require('objection');

class NotificacaoAparencia extends Model {
  static get tableName() { return 'notificacao_aparencias'; }
  static get idColumn() { return 'id'; }
}

module.exports = NotificacaoAparencia;
