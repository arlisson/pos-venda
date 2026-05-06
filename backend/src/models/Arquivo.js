const { Model } = require('objection');

class Arquivo extends Model {
  static get tableName() {
    return 'arquivos';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['hash_sha256', 'mime_type', 'storage_path'],
      properties: {
        id: { type: 'integer' },
        hash_sha256: { type: 'string', minLength: 64, maxLength: 64 },
        mime_type: { type: 'string', minLength: 1, maxLength: 120 },
        extensao: { type: ['string', 'null'], maxLength: 20 },
        tamanho_bytes: { type: ['integer', 'string'] },
        storage_driver: { type: 'string', maxLength: 40 },
        storage_path: { type: 'string', minLength: 1, maxLength: 700 },
        criado_por_id: { type: ['integer', 'null'] },
        removido_em: { type: ['string', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }
}

module.exports = Arquivo;
