const Notificacao = require('../models/Notificacao');
const NotificacaoDestinatario = require('../models/NotificacaoDestinatario');
const Usuario = require('../models/Usuario');
const db = require('../database/connection');

const TIPO_NOTIFICACAO = 'venda_parada_funil';
const DIAS_UTEIS_LIMITE = 5;

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

function contarDiasUteis(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;

  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  let diasUteis = 0;
  const atual = new Date(inicio);

  while (atual < fim) {
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteis++;
    }
    atual.setDate(atual.getDate() + 1);
  }

  return diasUteis;
}

async function registrarEntradaEstagio(vendaId, etapaCodigo, dataEntrada = new Date(), trx = null) {
  try {
    const query = db('venda_notificacao_parada')
      .where('venda_id', vendaId)
      .where('etapa_codigo', etapaCodigo);

    if (trx) {
      query.transacting(trx);
    }

    const existente = await query.first();

    if (existente) {
      await db('venda_notificacao_parada')
        .where('id', existente.id)
        .update({
          data_entrada_etapa: dataEntrada,
          updated_at: new Date()
        });
    } else {
      await db('venda_notificacao_parada').insert({
        venda_id: vendaId,
        etapa_codigo: etapaCodigo,
        data_entrada_etapa: dataEntrada,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  } catch (erro) {
    console.error('Erro ao registrar entrada no estágio:', erro);
  }
}

async function desativarNotificacaoVendaParada(vendaId, etapaCodigo, trx = null) {
  const sourceKey = `${TIPO_NOTIFICACAO}:${vendaId}:${etapaCodigo}`;
  
  const query = Notificacao.query(trx)
    .where('source_key', sourceKey);

  const notificacoes = await query.select('id');

  if (notificacoes.length > 0) {
    await NotificacaoDestinatario.query(trx)
      .whereIn('notificacao_id', notificacoes.map(n => n.id))
      .delete();
  }

  return Notificacao.query(trx)
    .where('source_key', sourceKey)
    .patch({ ativa: false, updated_at: new Date() });
}

async function sincronizarVendasParadas() {
  try {
    const agora = new Date();
    
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
      const diasUteis = contarDiasUteis(venda.data_entrada_etapa, agora);

      if (diasUteis >= DIAS_UTEIS_LIMITE) {
        const sourceKey = `${TIPO_NOTIFICACAO}:${venda.id}:${venda.etapa_codigo}`;
        const dados = {
          venda_id: venda.id,
          venda_nome: venda.nome,
          etapa_codigo: venda.etapa_codigo,
          etapa_nome: venda.etapa_nome,
          dias_uteis: diasUteis,
          data_entrada: venda.data_entrada_etapa
        };

        const payload = {
          tipo: TIPO_NOTIFICACAO,
          titulo: 'Venda parada no funil',
          mensagem: `A venda "${venda.nome}" está parada na etapa "${venda.etapa_nome}" há ${diasUteis} dias úteis.`,
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
      if (usuario.role?.nome === 'admin' || usuarioTemPermissao(usuario, 'notificacoes_receber_todas')) {
        ids.add(Number(usuario.id));
      }
    });

    if (venda.vendedora_id) {
      const vendedora = usuarios.find(u => Number(u.id) === Number(venda.vendedora_id));
      if (vendedora?.ativo) {
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
  DIAS_UTEIS_LIMITE,
  contarDiasUteis,
  registrarEntradaEstagio,
  desativarNotificacaoVendaParada,
  sincronizarVendasParadas,
  obterDestinatariosVenda
};
