const { Model } = require('objection');

class LeadSondagem extends Model {
  static get tableName() { return 'lead_sondagens'; }

  static get relationMappings() {
    const Operadora = require('./Operadora');
    const Usuario = require('./Usuario');
    return {
      operadoraAtual: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: { from: 'lead_sondagens.operadora_atual_id', to: 'operadoras.id' }
      },
      usuario: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: { from: 'lead_sondagens.usuario_id', to: 'usuarios.id' }
      }
    };
  }
}

module.exports = LeadSondagem;
