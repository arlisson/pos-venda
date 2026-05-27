const { Model } = require('objection');

/**
 * Modelo Objection para links externos exibidos na configuracao.
 */
class LinkExterno extends Model {
  static get tableName() {
    return 'links_externos';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = LinkExterno;
