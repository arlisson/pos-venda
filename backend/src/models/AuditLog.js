const { Model } = require('objection');

class AuditLog extends Model {
  static get tableName() {
    return 'audit_logs';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['acao'],

      properties: {
        id: { type: 'integer' },
        usuario_id: { type: ['integer', 'null'] },
        acao: { type: 'string', minLength: 1, maxLength: 120 },
        entidade: { type: ['string', 'null'], maxLength: 80 },
        entidade_id: { type: ['string', 'number', 'null'] },
        metodo: { type: ['string', 'null'], maxLength: 10 },
        rota: { type: ['string', 'null'], maxLength: 255 },
        ip: { type: ['string', 'null'], maxLength: 80 },
        user_agent: { type: ['string', 'null'], maxLength: 255 },
        dados: { type: ['object', 'array', 'string', 'null'] },
        created_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');

    return {
      usuario: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'audit_logs.usuario_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = AuditLog;
