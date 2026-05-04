const { Model } = require('objection');

class Plano extends Model {
  static get tableName() {
    return 'planos';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['nome', 'operadora_id', 'categoria', 'tipo_servico'],
      properties: {
        id: { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 120 },
        operadora_id: { type: 'integer' },
        categoria: { type: 'string', enum: ['movel', 'fixo', 'internet'] },
        tipo_servico: { type: 'string', enum: ['novo', 'portabilidade'] },
        taxa_comissao: { type: ['number', 'string'] },
        ativo: { type: 'boolean' },
        ordem: { type: 'integer' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }

  static get relationMappings() {
    const Operadora = require('./Operadora');

    return {
      operadora: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'planos.operadora_id',
          to: 'operadoras.id'
        }
      }
    };
  }
}

module.exports = Plano;
