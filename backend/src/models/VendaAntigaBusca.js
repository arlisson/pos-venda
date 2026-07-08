const { Model } = require('objection');

/**
 * Modelo Objection para o historico de buscas de clientes antigos.
 * Uma linha por consulta ("Usuario X buscou CNPJ Y em DD/MM/AA as HH:MM").
 */
class VendaAntigaBusca extends Model {
  static get tableName() {
    return 'vendas_antigas_buscas';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['cnpj_digitos'],

      properties: {
        id: { type: 'integer' },
        usuario_id: { type: ['integer', 'null'] },
        usuario_nome: { type: ['string', 'null'], maxLength: 160 },
        cnpj_digitos: { type: 'string', minLength: 1, maxLength: 14 },
        cnpj_formatado: { type: ['string', 'null'], maxLength: 18 },
        encontrou: { type: ['boolean', 'integer'] },
        buscado_em: { type: ['string', 'object', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
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
          from: 'vendas_antigas_buscas.usuario_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = VendaAntigaBusca;
