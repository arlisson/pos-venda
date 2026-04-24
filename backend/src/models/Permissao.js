const { Model } = require('objection');

class Permissao extends Model {
  static get tableName() {
    return 'permissoes'; // Nome da tabela no banco de dados
  }

  static get idColumn() {
    return 'id'; // Coluna da chave primária
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['chave', 'nome'],  // Colunas obrigatórias

      properties: {
        id: { type: 'integer' },
        chave: { type: 'string', minLength: 1, maxLength: 80 },
        nome: { type: 'string', minLength: 1, maxLength: 120 },
        descricao: { type: ['string', 'null'], maxLength: 255 },
        ativo: { type: ['boolean', 'integer'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }
}

module.exports = Permissao;