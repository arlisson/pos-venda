const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const db = require('../database/connection');
const { parseUtcDateTime } = require('../utils/datetime');

const TIPO_NOTIFICACAO = 'venda_parada_funil';
const PERMISSAO_VENDAS_PARADAS = 'notificacoes_vendas_paradas';
const HORAS_LIMITE = 5 * 24; // 5 dias corridos em horas

function parsePermissoes(permissoes) {
  if (!permissoes) return [];
  if (Array.isArray(permissoes)) return permissoes;

  if (typeof permissoes === 'string') {
    try {
      const parsed = JSON.parse(permissoes);
      if (Array.isArray(parsed)) return parsed;
      return Object.entries(parsed)
        .filter(([, permitido]) => permitido === true)
        .map(([chave]) => chave);
    } catch {
      return [];
    }
  }

  return Object.entries(permissoes)
    .filter(([, permitido]) => permitido === true)
    .map(([chave]) => chave);
}

function usuarioTemPermissao(usuario, permissao) {
  if (!usuario || !usuario.ativo) return false;
  if (usuario.role?.nome === 'admin') return true;

  return [
    ...parsePermissoes(usuario.permissoes),
    ...parsePermissoes(usuario.role?.permissoes)
  ].includes(permissao);
}

function horasDecorridas(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;
  const inicio = parseUtcDateTime(dataInicio);
  const fim = parseUtcDateTime(dataFim);
  if (!inicio || !fim) return 0;
  return (fim - inicio) / (1000 * 60 * 60);
}

async function registrarEntradaEstagio(vendaId, etapaCodigo, dataEntrada = new Date(), trx = null) {
  try {
    const executor = trx || db;
    const agora = new Date();

    await executor('venda_notificacao_parada')
      .insert({
        venda_id: vendaId,
        etapa_codigo: etapaCodigo,
        data_entrada_etapa: dataEntrada,
        created_at: agora,
        updated_at: agora
      })
      .onConflict(['venda_id', 'etapa_codigo'])
      .merge({
        data_entrada_etapa: dataEntrada,
        updated_at: agora
      });
  } catch (erro) {
    console.error('Erro ao registrar entrada no estágio:', erro);
  }
}

async function desativarNotificacaoVendaParada(vendaId, etapaCodigo, trx = null) {
  try {
    const sourceKey = `${TIPO_NOTIFICACAO}:${vendaId}:${etapaCodigo}`;

    const notificacoes = await Notificacao.query(trx)
      .where('source_key', sourceKey)
      .select('id');

    if (notificacoes.length > 0) {
      await NotificacaoDestinatario.query(trx)
        .whereIn('notificacao_id', notificacoes.map(n => n.id))
        .delete();
    }

    return Notificacao.query(trx)
      .where('source_key', sourceKey)
      .patch({ ativa: false, updated_at: new Date() });
  } catch (erro) {
    console.error('Erro ao desativar notificação de venda parada:', erro);
  }
}

async function garantirRegistrosEntradaAtivos() {
  const vendasSemRegistro = await db('vendas as v')
    .join('funil_etapas as fe', 'v.status_funil', 'fe.codigo')
    .leftJoin('venda_notificacao_parada as vnp', function () {
      this.on('v.id', '=', 'vnp.venda_id')
        .andOn('v.status_funil', '=', 'vnp.etapa_codigo');
    })
    .where('fe.etapa_final', false)
    .where('v.excluido_em', null)
    .whereNull('vnp.id')
    .whereNotNull('v.status_funil')
    .select(
      'v.id',
      'v.status_funil',
      'v.ultima_atividade_em',
      'v.updated_at',
      'v.criado_em'
    );

  for (const venda of vendasSemRegistro) {
    const historicoEntrada = await db('venda_historicos')
      .where('venda_id', venda.id)
      .where('status_novo', venda.status_funil)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .first();

    await registrarEntradaEstagio(
      venda.id,
      venda.status_funil,
      historicoEntrada?.created_at || venda.ultima_atividade_em || venda.updated_at || venda.criado_em || new Date()
    );
  }
}

async function sincronizarVendasParadas() {
  try {
    const agora = new Date();

    await garantirRegistrosEntradaAtivos();
    
    const vendas = await db('vendas as v')
      .join('venda_notificacao_parada as vnp', 'v.id', 'vnp.venda_id')
      .join('funil_etapas as fe', 'v.status_funil', 'fe.codigo')
      .where('fe.etapa_final', false)
      .where('v.excluido_em', null)
      .select(
        'v.id',
        'v.nome',
        'v.status_funil',
        'vnp.data_entrada_etapa',
        'v.vendedora_id',
        'fe.nome as etapa_nome',
        'fe.codigo as etapa_codigo'
      );

    for (const venda of vendas) {
      const horas = horasDecorridas(venda.data_entrada_etapa, agora);

      if (horas >= HORAS_LIMITE) {
        const dias = Math.floor(horas / 24);
        const sourceKey = `${TIPO_NOTIFICACAO}:${venda.id}:${venda.etapa_codigo}`;
        const dados = {
          venda_id: venda.id,
          venda_nome: venda.nome,
          etapa_codigo: venda.etapa_codigo,
          etapa_nome: venda.etapa_nome,
          horas: Math.floor(horas),
          data_entrada: venda.data_entrada_etapa
        };

        const payload = {
          tipo: TIPO_NOTIFICACAO,
          titulo: 'Venda parada no funil',
          mensagem: `A venda "${venda.nome}" está parada na etapa "${venda.etapa_nome}" há ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
          nivel: 'warn',
          entidade: 'vendas',
          entidade_id: venda.id,
          source_key: sourceKey,
          dados: JSON.stringify(dados),
          ativa: true,
          updated_at: agora
        };

        let notificacao = await Notificacao.query()
          .where('source_key', sourceKey)
          .first();

        if (notificacao) {
          notificacao = await Notificacao.query().patchAndFetchById(notificacao.id, payload);
        } else {
          notificacao = await Notificacao.query().insertAndFetch(payload);
        }

        const destinatarios = await obterDestinatariosVenda(venda);

        const destinatariosQuery = NotificacaoDestinatario.query()
          .where('notificacao_id', notificacao.id);

        if (destinatarios.length > 0) {
          destinatariosQuery.whereNotIn('usuario_id', destinatarios);
        }

        await destinatariosQuery.delete();

        for (const usuarioId of destinatarios) {
          const existente = await NotificacaoDestinatario.query()
            .where('notificacao_id', notificacao.id)
            .where('usuario_id', usuarioId)
            .first();

          if (!existente) {
            await NotificacaoDestinatario.query().insert({
              notificacao_id: notificacao.id,
              usuario_id: usuarioId
            });
          }
        }
      }
    }
  } catch (erro) {
    console.error('Erro ao sincronizar vendas paradas:', erro);
  }
}

async function obterDestinatariosVenda(venda) {
  try {
    const usuarios = await Usuario.query()
      .withGraphFetched('role')
      .where('ativo', true);

    const ids = new Set();

    usuarios.forEach(usuario => {
      if (usuarioTemPermissao(usuario, PERMISSAO_VENDAS_PARADAS)) {
        ids.add(Number(usuario.id));
      }
    });

    if (venda.vendedora_id) {
      const vendedora = usuarios.find(u => Number(u.id) === Number(venda.vendedora_id));
      if (usuarioTemPermissao(vendedora, PERMISSAO_VENDAS_PARADAS)) {
        ids.add(Number(venda.vendedora_id));
      }
    }

    return Array.from(ids);
  } catch (erro) {
    console.error('Erro ao obter destinatários da venda:', erro);
    return [];
  }
}

module.exports = {
  TIPO_NOTIFICACAO,
  PERMISSAO_VENDAS_PARADAS,
  HORAS_LIMITE,
  horasDecorridas,
  registrarEntradaEstagio,
  desativarNotificacaoVendaParada,
  sincronizarVendasParadas,
  obterDestinatariosVenda
};
