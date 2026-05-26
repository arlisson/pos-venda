const { Model } = require('objection');

class MensagemArquivo extends Model {
  static get tableName() {
    return 'mensagem_arquivos';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['mensagem_id', 'arquivo_id', 'nome_original'],
      properties: {
        id: { type: 'integer' },
        mensagem_id: { type: 'integer' },
        arquivo_id: { type: 'integer' },
        nome_original: { type: 'string', minLength: 1, maxLength: 255 },
        created_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Arquivo = require('./Arquivo');
    const Mensagem = require('./Mensagem');

    return {
      arquivo: {
        relation: Model.BelongsToOneRelation,
        modelClass: Arquivo,
        join: { from: 'mensagem_arquivos.arquivo_id', to: 'arquivos.id' }
      },
      mensagem: {
        relation: Model.BelongsToOneRelation,
        modelClass: Mensagem,
        join: { from: 'mensagem_arquivos.mensagem_id', to: 'mensagens.id' }
      }
    };
  }
}

module.exports = MensagemArquivo;
