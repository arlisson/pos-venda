const { Model } = require('objection');

/**
 * Modelo Objection para linhas importadas em planilhas de leads.
 */
class LeadLinha extends Model {
  static get tableName() {
    return 'lead_linhas';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['planilha_id', 'row_index', 'dados_json'],
      properties: {
        id: { type: 'integer' },
        planilha_id: { type: 'integer' },
        row_index: { type: 'integer' },
        dados_json: { type: ['object', 'string'] },
        atribuido_para_id: { type: ['integer', 'null'] },
        envio_id: { type: ['integer', 'null'] },
        futuro_cliente: { type: ['boolean', 'integer'] },
        futuro_cliente_notas: { type: ['string', 'null'] },
        futuro_cliente_retorno: { type: ['string', 'object', 'null'] },
        futuro_cliente_marcado_em: { type: ['string', 'object', 'null'] },
        futuro_cliente_marcado_por_id: { type: ['integer', 'null'] },
        etapa_atual: { type: ['string', 'null'] },
        status_operacional: { type: ['string', 'null'] },
        cliente_id: { type: ['integer', 'null'] },
        venda_id: { type: ['integer', 'null'] },
        futuro_cliente_excluido_em: { type: ['string', 'object', 'null'] },
        futuro_cliente_excluir_definitivo_em: { type: ['string', 'object', 'null'] },
        futuro_cliente_excluido_por_id: { type: ['integer', 'null'] },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const LeadPlanilha = require('./LeadPlanilha');
    const LeadEnvio = require('./LeadEnvio');
    const Usuario = require('./Usuario');
    const LeadSondagem = require('./LeadSondagem');

    return {
      planilha: {
        relation: Model.BelongsToOneRelation,
        modelClass: LeadPlanilha,
        join: {
          from: 'lead_linhas.planilha_id',
          to: 'lead_planilhas.id'
        }
      },
      envio: {
        relation: Model.BelongsToOneRelation,
        modelClass: LeadEnvio,
        join: {
          from: 'lead_linhas.envio_id',
          to: 'lead_envios.id'
        }
      },
      atribuidoPara: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'lead_linhas.atribuido_para_id',
          to: 'usuarios.id'
        }
      },
      sondagem: {
        relation: Model.HasOneRelation,
        modelClass: LeadSondagem,
        join: {
          from: 'lead_linhas.id',
          to: 'lead_sondagens.lead_linha_id'
        }
      },
      futuroClienteExcluidoPor: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'lead_linhas.futuro_cliente_excluido_por_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = LeadLinha;
