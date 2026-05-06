const { Model } = require('objection');

class VendaArquivo extends Model {
  static get tableName() {
    return 'venda_arquivos';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['venda_id', 'arquivo_id', 'nome_original'],
      properties: {
        id: { type: 'integer' },
        venda_id: { type: 'integer' },
        arquivo_id: { type: 'integer' },
        nome_original: { type: 'string', minLength: 1, maxLength: 255 },
        categoria: { type: 'string', maxLength: 40 },
        descricao: { type: ['string', 'null'], maxLength: 500 },
        ordem: { type: 'integer' },
        criado_por_id: { type: ['integer', 'null'] },
        arquivado_no_pacote_id: { type: ['integer', 'null'] },
        remover_apos: { type: ['string', 'null'] },
        excluido_em: { type: ['string', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Arquivo = require('./Arquivo');
    const Usuario = require('./Usuario');
    const VendaArquivoPacote = require('./VendaArquivoPacote');

    return {
      arquivo: {
        relation: Model.BelongsToOneRelation,
        modelClass: Arquivo,
        join: {
          from: 'venda_arquivos.arquivo_id',
          to: 'arquivos.id'
        }
      },
      criadoPor: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'venda_arquivos.criado_por_id',
          to: 'usuarios.id'
        }
      },
      pacote: {
        relation: Model.BelongsToOneRelation,
        modelClass: VendaArquivoPacote,
        join: {
          from: 'venda_arquivos.arquivado_no_pacote_id',
          to: 'venda_arquivo_pacotes.id'
        }
      }
    };
  }
}

module.exports = VendaArquivo;
