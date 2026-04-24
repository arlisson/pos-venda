const { Model } = require('objection');

class Role extends Model {
  static get tableName() {
    return 'roles';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['nome', 'permissoes'],

      properties: {
        id: { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 50 },
        descricao: { type: ['string', 'null'], maxLength: 255 },
        permissoes: {
          type: ['object', 'string']
        },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  temPermissao(modulo) {
    const permissoes = typeof this.permissoes === 'string'
      ? JSON.parse(this.permissoes)
      : this.permissoes;

    return permissoes?.[modulo] === true;
  }
}

module.exports = Role;