const Meta = require('../models/Meta');
const knex = require('../database/connection');

function validarMeta(meta) {
  if (!meta.desc || !Number(meta.target)) {
    return 'Alvo e descricao sao obrigatorios.';
  }

  if (Number(meta.target) < 1) {
    return 'Alvo deve ser maior que zero.';
  }

  if (!Meta.periodosValidos.includes(meta.periodo)) {
    return 'Periodo invalido.';
  }

  if (!Meta.categoriasValidas.includes(meta.categoria)) {
    return 'Categoria invalida.';
  }

  return null;
}

function metaEhGift(meta) {
  return meta.is_gift === true || meta.is_gift === 1 || meta.is_gift === '1';
}

function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCiclo(periodo, baseDate = new Date()) {
  if (periodo === 'semanal') {
    const diaSemana = baseDate.getDay();
    const diasParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
    const inicio = new Date(baseDate);
    inicio.setDate(baseDate.getDate() + diasParaSegunda);
    inicio.setHours(0, 0, 0, 0);

    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 7);

    return {
      periodo: 'semanal',
      inicio,
      fim,
      inicioStr: toDateStr(inicio),
      fimStr: toDateStr(fim)
    };
  }

  const inicio = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 1);

  return {
    periodo: 'diaria',
    inicio,
    fim,
    inicioStr: toDateStr(inicio),
    fimStr: toDateStr(fim)
  };
}

async function contarVendas(vendedoraId, ciclo) {
  const dataReferencia = "COALESCE(NULLIF(v.data_venda, '0000-00-00'), NULLIF(DATE(v.criado_em), '0000-00-00'), DATE(v.created_at))";

  return knex('vendas as v')
    .leftJoin('tipos_venda as tv', 'v.tipo_venda_id', 'tv.id')
    .leftJoin('servicos as s', 'v.servico_id', 's.id')
    .select('tv.nome as tipo_venda', 's.nome as servico')
    .count('v.id as total')
    .where('v.vendedora_id', vendedoraId)
    .whereNot('v.status_funil', 'retorno')
    .whereRaw(`${dataReferencia} >= ?`, [ciclo.inicioStr])
    .whereRaw(`${dataReferencia} < ?`, [ciclo.fimStr])
    .groupBy('tv.nome', 's.nome');
}

function classificar(rows) {
  let registro_cliente = 0, chip_novo = 0, portabilidade = 0, internet = 0;
  for (const row of rows) {
    const count = Number(row.total);
    registro_cliente += count;
    if (row.tipo_venda === 'Portabilidade') portabilidade += count;
    if (row.servico === 'Internet') internet += count;
    if (row.tipo_venda === 'Novo') chip_novo += count;
  }
  return { registro_cliente, chip_novo, portabilidade, internet };
}

class MetaController {
  async index(req, res) {
    try {
      const metas = await Meta.findAll();
      res.json(metas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar metas.' });
    }
  }

  async updateBulk(req, res) {
    try {
      const { metas } = req.body;
      if (!Array.isArray(metas)) {
        return res.status(400).json({ error: 'Formato invalido. Esperado um array de metas.' });
      }

      const invalida = metas.find(meta => metaEhGift(meta) && validarMeta(meta));
      if (invalida) {
        return res.status(400).json({ error: validarMeta(invalida) });
      }

      await Meta.updateAll(metas);
      const updatedMetas = await Meta.findAll();

      res.json({ message: 'Metas atualizadas com sucesso.', metas: updatedMetas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar metas.' });
    }
  }

  async store(req, res) {
    try {
      const erro = validarMeta(req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const meta = await Meta.create({
        periodo: req.body.periodo,
        categoria: req.body.categoria,
        target: Number(req.body.target),
        desc: req.body.desc,
        reward: req.body.reward,
        is_gift: true
      });

      res.status(201).json(meta);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar meta.' });
    }
  }

  async progresso(req, res) {
    try {
      const vendedoraId = req.usuario.id;
      const cicloDiario = getCiclo('diaria');
      const cicloSemanal = getCiclo('semanal');

      const [rowsDiaria, rowsSemanal] = await Promise.all([
        contarVendas(vendedoraId, cicloDiario),
        contarVendas(vendedoraId, cicloSemanal),
      ]);

      const diaria = classificar(rowsDiaria);
      const semanal = classificar(rowsSemanal);
      const resgates = await knex('meta_resgates')
        .where('usuario_id', vendedoraId)
        .where(builder => {
          builder
            .where(query => {
              query.where('periodo', 'diaria').where('periodo_inicio', cicloDiario.inicioStr);
            })
            .orWhere(query => {
              query.where('periodo', 'semanal').where('periodo_inicio', cicloSemanal.inicioStr);
            });
        })
        .pluck('meta_id');

      res.json({
        diaria_registro_cliente: diaria.registro_cliente,
        diaria_chip_novo: diaria.chip_novo,
        diaria_portabilidade: diaria.portabilidade,
        diaria_internet: diaria.internet,
        semanal_registro_cliente: semanal.registro_cliente,
        semanal_chip_novo: semanal.chip_novo,
        semanal_portabilidade: semanal.portabilidade,
        semanal_internet: semanal.internet,
        resgatadas: resgates.map(Number),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao calcular progresso.' });
    }
  }

  async resgatar(req, res) {
    try {
      const usuarioId = req.usuario.id;
      const meta = await knex('metas').where({ id: req.params.id }).first();

      if (!meta) {
        return res.status(404).json({ error: 'Meta nao encontrada.' });
      }

      if (!metaEhGift(meta)) {
        return res.status(400).json({ error: 'Esta meta nao possui recompensa para resgate.' });
      }

      const ciclo = getCiclo(meta.periodo);
      const existente = await knex('meta_resgates')
        .where({
          usuario_id: usuarioId,
          meta_id: meta.id,
          periodo_inicio: ciclo.inicioStr
        })
        .first();

      if (existente) {
        return res.json({
          message: 'Meta ja resgatada neste ciclo.',
          resgatada: true,
          jaResgatada: true,
          metaId: meta.id,
          reward: existente.reward_snapshot || meta.reward,
          resgate: existente
        });
      }

      const rows = await contarVendas(usuarioId, ciclo);
      const progresso = classificar(rows);
      const current = progresso[meta.categoria] || 0;
      const target = Number(meta.target) || 0;

      if (current < target) {
        return res.status(400).json({
          error: 'Meta ainda nao atingida.',
          current,
          target
        });
      }

      const dadosResgate = {
        usuario_id: usuarioId,
        meta_id: meta.id,
        periodo: ciclo.periodo,
        periodo_inicio: ciclo.inicioStr,
        periodo_fim: ciclo.fimStr,
        reward_snapshot: meta.reward || null,
        claimed_at: knex.fn.now(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      };

      let id;
      try {
        [id] = await knex('meta_resgates').insert(dadosResgate);
      } catch (insertError) {
        if (insertError && insertError.code === 'ER_DUP_ENTRY') {
          const resgateExistente = await knex('meta_resgates')
            .where({
              usuario_id: usuarioId,
              meta_id: meta.id,
              periodo_inicio: ciclo.inicioStr
            })
            .first();

          return res.json({
            message: 'Meta ja resgatada neste ciclo.',
            resgatada: true,
            jaResgatada: true,
            metaId: meta.id,
            reward: resgateExistente?.reward_snapshot || meta.reward,
            resgate: resgateExistente
          });
        }

        throw insertError;
      }

      const resgate = await knex('meta_resgates').where({ id }).first();

      res.status(201).json({
        message: 'Meta resgatada com sucesso.',
        resgatada: true,
        jaResgatada: false,
        metaId: meta.id,
        reward: resgate.reward_snapshot || meta.reward,
        resgate
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao resgatar meta.' });
    }
  }

  async destroy(req, res) {
    try {
      const deleted = await Meta.deleteById(req.params.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Meta nao encontrada.' });
      }

      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir meta.' });
    }
  }
}

module.exports = new MetaController();
