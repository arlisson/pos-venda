const { Model } = require('objection');

class NotificacaoDestinatario extends Model {
  static get tableName() {
    return 'notificacao_destinatarios';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = NotificacaoDestinatario;
