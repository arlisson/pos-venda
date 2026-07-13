const { Model } = require('objection');

class LeadAtribuicao extends Model {
  static get tableName() { return 'lead_atribuicoes'; }
}

module.exports = LeadAtribuicao;

