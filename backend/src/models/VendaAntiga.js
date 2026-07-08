const { Model } = require('objection');

/**
 * Modelo Objection para a base de vendas antigas importada por planilha.
 * Base isolada (nao se relaciona com a tabela `vendas`); usada apenas pela
 * ferramenta de busca de clientes antigos.
 */
class VendaAntiga extends Model {
  static get tableName() {
    return 'vendas_antigas';
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
        cnpj: { type: ['string', 'null'], maxLength: 18 },
        cnpj_digitos: { type: 'string', minLength: 1, maxLength: 14 },
        razao_social: { type: ['string', 'null'], maxLength: 255 },
        nome_fantasia: { type: ['string', 'null'], maxLength: 255 },
        data_venda: { type: ['string', 'object', 'null'] },
        dados_extras: { type: ['string', 'null'] },
        lote: { type: ['string', 'null'], maxLength: 120 },
        importado_por_id: { type: ['integer', 'null'] },
        importado_em: { type: ['string', 'object', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }
}

module.exports = VendaAntiga;
