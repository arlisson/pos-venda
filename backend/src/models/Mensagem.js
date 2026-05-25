const { Model } = require('objection');

class Mensagem extends Model {
  static get tableName() {
    return 'mensagens';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['remetente_id', 'destinatario_id', 'conteudo'],
      properties: {
        id: { type: 'integer' },
        remetente_id: { type: 'integer' },
        destinatario_id: { type: 'integer' },
        conteudo: { type: 'string', minLength: 1 },
        // Tipos sem 'object': com 'object', o Objection trata a coluna como JSON
        // e faz JSON.stringify do valor (gravando timestamp com aspas -> 0000-00-00).
        recebida_em: { type: ['string', 'null'] },
        lida_em: { type: ['string', 'null'] },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');

    return {
      remetente: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: { from: 'mensagens.remetente_id', to: 'usuarios.id' }
      },
      destinatario: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: { from: 'mensagens.destinatario_id', to: 'usuarios.id' }
      }
    };
  }
}

module.exports = Mensagem;
