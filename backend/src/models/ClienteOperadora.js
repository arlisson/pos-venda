const { Model } = require('objection');

class ClienteOperadora extends Model {
  static get tableName() {
    return 'cliente_operadoras';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cliente_id', 'operadora_id'],
      properties: {
        id: { type: 'integer' },
        cliente_id: { type: 'integer' },
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
    const Cliente = require('./Cliente');
    const Operadora = require('./Operadora');

    return {
      cliente: {
        relation: Model.BelongsToOneRelation,
        modelClass: Cliente,
        join: {
          from: 'cliente_operadoras.cliente_id',
          to: 'clientes.id'
        }
      },
      operadora: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'cliente_operadoras.operadora_id',
          to: 'operadoras.id'
        }
      }
    };
  }
}

module.exports = ClienteOperadora;
