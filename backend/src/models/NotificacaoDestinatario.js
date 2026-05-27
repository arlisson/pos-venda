const { Model } = require('objection');

/**
 * Modelo Objection para destinatarios e leitura de notificacoes.
 */
class NotificacaoDestinatario extends Model {
  static get tableName() {
    return 'notificacao_destinatarios';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = NotificacaoDestinatario;
