const { Model } = require('objection');

class LeadEnvioUsuario extends Model {
  static get tableName() {
    return 'lead_envio_usuarios';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['envio_id', 'usuario_id', 'quantidade'],
      properties: {
        id: { type: 'integer' },
        envio_id: { type: 'integer' },
        usuario_id: { type: 'integer' },
        quantidade: { type: 'integer' },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const LeadEnvio = require('./LeadEnvio');
    const Usuario = require('./Usuario');

    return {
      envio: {
        relation: Model.BelongsToOneRelation,
        modelClass: LeadEnvio,
        join: {
          from: 'lead_envio_usuarios.envio_id',
          to: 'lead_envios.id'
        }
      },
      usuario: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'lead_envio_usuarios.usuario_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = LeadEnvioUsuario;
