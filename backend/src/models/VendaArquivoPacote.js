const { Model } = require('objection');

class VendaArquivoPacote extends Model {
  static get tableName() {
    return 'venda_arquivo_pacotes';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['venda_id', 'status'],
      properties: {
        id: { type: 'integer' },
        venda_id: { type: 'integer' },
        status: { type: 'string', maxLength: 30 },
        hash_sha256: { type: ['string', 'null'], maxLength: 64 },
        tamanho_bytes: { type: ['integer', 'string', 'null'] },
        storage_driver: { type: 'string', maxLength: 40 },
        storage_path: { type: ['string', 'null'], maxLength: 700 },
        total_arquivos: { type: 'integer' },
        erro: { type: ['string', 'null'] },
        gerado_por_id: { type: ['integer', 'null'] },
        gerado_em: { type: ['string', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }
}

module.exports = VendaArquivoPacote;
