const { Model } = require('objection');

class ClienteSecretoOperadora extends Model {
  static get tableName() {
    return 'cliente_secreto_operadoras';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cliente_secreto_id', 'operadora_id'],
      properties: {
        id: { type: 'integer' },
        cliente_secreto_id: { type: 'integer' },
        operadora_id: { type: 'integer' },
        quantidade_chips: { type: ['integer', 'null'] },
        valor_pago: { type: ['number', 'string', 'null'] },
        fidelidade_fim: { type: ['string', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const ClienteSecreto = require('./ClienteSecreto');
    const Operadora = require('./Operadora');

    return {
      cliente: {
        relation: Model.BelongsToOneRelation,
        modelClass: ClienteSecreto,
        join: {
          from: 'cliente_secreto_operadoras.cliente_secreto_id',
          to: 'clientes_secretos.id'
        }
      },
      operadora: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'cliente_secreto_operadoras.operadora_id',
          to: 'operadoras.id'
        }
      }
    };
  }
}

module.exports = ClienteSecretoOperadora;
