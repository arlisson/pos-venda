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
      required: ['remetente_id', 'destinatario_id'],
      properties: {
        id: { type: 'integer' },
        remetente_id: { type: 'integer' },
        destinatario_id: { type: 'integer' },
        conteudo: { type: ['string', 'null'] },
        // Tipos sem 'object': com 'object', o Objection trata a coluna como JSON
        // e faz JSON.stringify do valor (gravando timestamp com aspas -> 0000-00-00).
        recebida_em: { type: ['string', 'null'] },
        lida_em: { type: ['string', 'null'] },
        excluido_em: { type: ['string', 'null'] },
        tinha_anexo: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    };
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');
    const MensagemArquivo = require('./MensagemArquivo');

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
      },
      // 1 anexo por mensagem; HasOne via tabela de vínculo.
      anexo: {
        relation: Model.HasOneRelation,
        modelClass: MensagemArquivo,
        join: { from: 'mensagens.id', to: 'mensagem_arquivos.mensagem_id' }
      }
    };
  }
}

module.exports = Mensagem;
