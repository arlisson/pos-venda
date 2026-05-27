const { Model } = require('objection');

/**
 * Modelo Objection para eventos do fluxo de problemas de venda.
 */
class VendaProblemaEvento extends Model {
  static get tableName() {
    return 'venda_problema_eventos';
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
          from: 'venda_problema_eventos.usuario_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = VendaProblemaEvento;
