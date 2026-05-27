const { Model } = require('objection');

/**
 * Modelo Objection para notificacoes geradas pelo sistema.
 */
class Notificacao extends Model {
  static get tableName() {
    return 'notificacoes';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Notificacao;
