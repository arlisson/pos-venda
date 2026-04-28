const { Model } = require('objection');

class Venda extends Model {
  static get tableName() {
    return 'vendas';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['nome', 'vendedora_id'],
      properties: {
        id: { type: 'integer' },
        nome: { type: 'string', minLength: 1, maxLength: 240 },
        telefone: { type: ['string', 'null'], maxLength: 40 },
        email: { type: ['string', 'null'], maxLength: 160 },
        email_2: { type: ['string', 'null'], maxLength: 160 },
        criado_em: { type: ['string', 'object', 'null'] },
        ultima_atividade_em: { type: ['string', 'object', 'null'] },
        nome_representante_legal: { type: ['string', 'null'], maxLength: 240 },
        fixo_ddd: { type: ['string', 'null'], maxLength: 40 },
        nome_fechou_venda: { type: ['string', 'null'], maxLength: 240 },
        cpf_representante_legal: { type: ['string', 'null'], maxLength: 20 },
        setor_funcao: { type: ['string', 'null'], maxLength: 120 },
        produto_fechado: { type: ['string', 'null'], maxLength: 160 },
        quantidade_linhas: { type: ['integer', 'null'] },
        ddd: { type: ['string', 'null'], maxLength: 10 },
        numeros_portados: { type: ['string', 'null'] },
        gb: { type: ['string', 'null'], maxLength: 40 },
        valores_unitarios_chips: { type: ['string', 'null'] },
        valor_total: { type: ['number', 'string', 'null'] },
        ponto_referencia: { type: ['string', 'null'], maxLength: 255 },
        tipo_local_cpf: { type: ['string', 'null'], maxLength: 160 },
        razao_social: { type: ['string', 'null'], maxLength: 240 },
        cnpj: { type: ['string', 'null'], maxLength: 20 },
        data_venda: { type: ['string', 'object', 'null'] },
        qc_feito_por: { type: ['string', 'null'], maxLength: 120 },
        observacoes: { type: ['string', 'null'] },
        dia_vencimento: { type: ['integer', 'null'] },
        endereco: { type: ['string', 'null'], maxLength: 255 },
        numero_endereco: { type: ['string', 'null'], maxLength: 30 },
        complemento: { type: ['string', 'null'], maxLength: 160 },
        bairro: { type: ['string', 'null'], maxLength: 120 },
        municipio: { type: ['string', 'null'], maxLength: 120 },
        uf: { type: ['string', 'null'], maxLength: 2 },
        cep: { type: ['string', 'null'], maxLength: 20 },
        horario_aceite_voz: { type: ['string', 'null'], maxLength: 120 },
        responsavel_recebimento: { type: ['string', 'null'], maxLength: 240 },
        rg_responsavel_recebimento: { type: ['string', 'null'], maxLength: 40 },
        nome_administrador: { type: ['string', 'null'], maxLength: 240 },
        cpf_administrador: { type: ['string', 'null'], maxLength: 40 },
        operadora_id: { type: ['integer', 'null'] },
        tipo_produto_id: { type: ['integer', 'null'] },
        tipo_venda_id: { type: ['integer', 'null'] },
        servico_id: { type: ['integer', 'null'] },
        criado_por_id: { type: ['integer', 'null'] },
        vendedora_id: { type: 'integer' },
        created_at: { type: ['string', 'object'] },
        updated_at: { type: ['string', 'object'] }
      }
    };
  }

  static get relationMappings() {
    const Usuario = require('./Usuario');
    const Operadora = require('./Operadora');
    const TipoProduto = require('./TipoProduto');
    const TipoVenda = require('./TipoVenda');
    const Servico = require('./Servico');

    return {
      operadora: {
        relation: Model.BelongsToOneRelation,
        modelClass: Operadora,
        join: {
          from: 'vendas.operadora_id',
          to: 'operadoras.id'
        }
      },
      tipoProduto: {
        relation: Model.BelongsToOneRelation,
        modelClass: TipoProduto,
        join: {
          from: 'vendas.tipo_produto_id',
          to: 'tipos_produto.id'
        }
      },
      tipoVenda: {
        relation: Model.BelongsToOneRelation,
        modelClass: TipoVenda,
        join: {
          from: 'vendas.tipo_venda_id',
          to: 'tipos_venda.id'
        }
      },
      servico: {
        relation: Model.BelongsToOneRelation,
        modelClass: Servico,
        join: {
          from: 'vendas.servico_id',
          to: 'servicos.id'
        }
      },
      criador: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'vendas.criado_por_id',
          to: 'usuarios.id'
        }
      },
      vendedora: {
        relation: Model.BelongsToOneRelation,
        modelClass: Usuario,
        join: {
          from: 'vendas.vendedora_id',
          to: 'usuarios.id'
        }
      }
    };
  }
}

module.exports = Venda;
