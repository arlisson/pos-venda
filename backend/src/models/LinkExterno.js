const { Model } = require('objection');

class LinkExterno extends Model {
  static get tableName() {
    return 'links_externos';
  }

  static get idColumn() {
    return 'id';
  }
}

module.exports = LinkExterno;
