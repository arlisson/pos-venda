const { Model } = require('objection');

/**
 * Modelo Objection para servicos comercializados.
 */
class Servico extends Model {
  static get tableName() {
    return 'servicos';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = Servico;
