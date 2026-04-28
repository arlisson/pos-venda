const { Model } = require('objection');

class Cliente extends Model {
  static get tableName() {
    return 'clientes';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['nome'],
      properties: {
        id: { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 240 },
        razao_social: { type: ['string', 'null'], maxLength: 240 },
        cnpj: { type: ['string', 'null'], maxLength: 20 },
        responsavel_tipo: { type: 'string', enum: ['adm', 'rl'] },
        responsavel_nome: { type: ['string', 'null'], maxLength: 240 },
        email: { type: ['string', 'null'], maxLength: 160 },
        whatsapp_ddd: { type: ['string', 'null'], maxLength: 4 },
        whatsapp_numero: { type: ['string', 'null'], maxLength: 20 },
        fixo_ddd: { type: ['string', 'null'], maxLength: 4 },
        fixo_numero: { type: ['string', 'null'], maxLength: 20 },
        fidelidade_fim: { type: ['string', 'null'] },
        operadora_atual_id: { type: ['integer', 'null'] },
        quantidade_chips: { type: ['integer', 'null'] },
        criado_por_id: { type: ['integer', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Operadora = require('./Operadora');
    const Usuario = require('./Usuario');
    const Venda = require('./Venda');

    return {
      operadoraAtual: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'clientes.operadora_atual_id',
          to: 'operadoras.id'
        }
      },
      criador: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'clientes.criado_por_id',
          to: 'usuarios.id'
        }
      },
      vendas: {
        relation: Model.HasManyRelation,
        modelClass: Venda,
        join: {
          from: 'clientes.id',
          to: 'vendas.cliente_id'
        }
      }
    };
  }
}

module.exports = Cliente;
