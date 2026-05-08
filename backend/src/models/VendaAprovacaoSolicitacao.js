const { Model } = require('objection');

class VendaAprovacaoSolicitacao extends Model {
  static get tableName() {
    return 'venda_aprovacao_solicitacoes';
  }

  static get idColumn() {
    return 'id';
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');
    const Venda = require('./Venda');

    return {
      venda: {
        relation: Model.BelongsToOneRelation,
        modelClass: Venda,
        join: {
          from: 'venda_aprovacao_solicitacoes.venda_id',
          to: 'vendas.id'
        }
      },
      solicitante: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'venda_aprovacao_solicitacoes.solicitado_por_id',
          to: 'usuarios.id'
        }
      },
      decisor: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'venda_aprovacao_solicitacoes.decidido_por_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = VendaAprovacaoSolicitacao;
