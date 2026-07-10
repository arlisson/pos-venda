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
      required: ['chave_dedup'],

      properties: {
        id: { type: 'integer' },
        cnpj: { type: ['string', 'null'], maxLength: 18 },
        cnpj_digitos: { type: ['string', 'null'], maxLength: 14 },
        documento_digitos: { type: ['string', 'null'], maxLength: 14 },
        documento_tipo: { type: ['string', 'null'], maxLength: 12 },
        chave_dedup: { type: 'string', minLength: 1, maxLength: 191 },
        razao_social: { type: ['string', 'null'], maxLength: 255 },
        nome_fantasia: { type: ['string', 'null'], maxLength: 255 },
        data_venda: { type: ['string', 'object', 'null'] },
        operadora: { type: ['string', 'null'], maxLength: 255 },
        responsavel_nome: { type: ['string', 'null'], maxLength: 255 },
        telefone: { type: ['string', 'null'], maxLength: 80 },
        quantidade_chips: { type: ['integer', 'null'] },
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
