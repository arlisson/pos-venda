const { Model } = require('objection');

/**
 * Modelo Objection para o historico de buscas de clientes antigos.
 * Uma linha por consulta ("Usuario X buscou <termo> em DD/MM/AA as HH:MM").
 * O termo pode ser um CNPJ, um CPF ou um trecho de razao social (`tipo_busca`).
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
      required: [],

      properties: {
        id: { type: 'integer' },
        usuario_id: { type: ['integer', 'null'] },
        usuario_nome: { type: ['string', 'null'], maxLength: 160 },
        cnpj_digitos: { type: ['string', 'null'], maxLength: 14 },
        cnpj_formatado: { type: ['string', 'null'], maxLength: 18 },
        termo: { type: ['string', 'null'], maxLength: 255 },
        tipo_busca: { type: 'string', maxLength: 12 },
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
