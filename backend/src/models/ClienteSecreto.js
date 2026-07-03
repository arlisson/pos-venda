const { Model } = require('objection');

class ClienteSecreto extends Model {
  static get tableName() {
    return 'clientes_secretos';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['nome', 'criado_por_id'],
      properties: {
        id: { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 240 },
        razao_social: { type: ['string', 'null'], maxLength: 240 },
        cnpj: { type: ['string', 'null'], maxLength: 20 },
        cnpj_digitos: { type: ['string', 'null'], maxLength: 14 },
        responsavel_tipo: { type: 'string', enum: ['adm', 'rl'] },
        responsavel_nome: { type: ['string', 'null'], maxLength: 240 },
        email: { type: ['string', 'null'], maxLength: 160 },
        whatsapp_ddd: { type: ['string', 'null'], maxLength: 4 },
        whatsapp_numero: { type: ['string', 'null'], maxLength: 20 },
        fixo_ddd: { type: ['string', 'null'], maxLength: 4 },
        fixo_numero: { type: ['string', 'null'], maxLength: 20 },
        fidelidade_fim: { type: ['string', 'null'] },
        operadora_atual_id: { type: ['integer', 'null'] },
        valor_pago: { type: ['number', 'string', 'null'] },
        quantidade_chips: { type: ['integer', 'null'] },
        criado_por_id: { type: 'integer' },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Operadora = require('./Operadora');
    const Usuario = require('./Usuario');
    const ClienteSecretoOperadora = require('./ClienteSecretoOperadora');

    return {
      operadoraAtual: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'clientes_secretos.operadora_atual_id',
          to: 'operadoras.id'
        }
      },
      operadorasAtuais: {
        relation: Model.HasManyRelation,
        modelClass: ClienteSecretoOperadora,
        join: {
          from: 'clientes_secretos.id',
          to: 'cliente_secreto_operadoras.cliente_secreto_id'
        }
      },
      criador: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'clientes_secretos.criado_por_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = ClienteSecreto;
