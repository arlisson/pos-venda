const { Model } = require('objection');

class VendaProblemaDestinatario extends Model {
  static get tableName() {
    return 'venda_problema_destinatarios';
  }

  static get idColumn() {
    return 'id';
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');

    return {
      usuario: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'venda_problema_destinatarios.usuario_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = VendaProblemaDestinatario;
