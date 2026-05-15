const Campanha = require('../models/Campanha');
const knex = require('../database/connection');

function validarCampanha(campanha) {
  if (!campanha.desc || !Number(campanha.target)) {
    return 'Alvo e descricao sao obrigatorios.';
  }

  if (Number(campanha.target) < 1) {
    return 'Alvo deve ser maior que zero.';
  }

  if (!Campanha.periodosValidos.includes(campanha.periodo)) {
    return 'Período inválido.';
  }

  if (!Campanha.categoriasValidas.includes(campanha.categoria)) {
    return 'Categoria inválida.';
  }

  return null;
}

function campanhaEhGift(campanha) {
  return campanha.is_gift === true || campanha.is_gift === 1 || campanha.is_gift === '1';
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

  if (periodo === 'mensal') {
    const inicio = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const fim = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

    return {
      periodo: 'mensal',
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

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function somarQuantidadeChips(valoresUnitariosChips, quantidadeLinhas, fallback = 0) {
  if (valoresUnitariosChips) {
    try {
      const itens = typeof valoresUnitariosChips === 'string'
        ? JSON.parse(valoresUnitariosChips)
        : valoresUnitariosChips;

      if (Array.isArray(itens)) {
        const total = itens.reduce((acc, item) => acc + Number(item?.quantidade || 0), 0);

        if (total > 0) {
          return total;
        }
      }
    } catch {
      // Usa fallback abaixo quando o JSON antigo estiver inválido.
    }
  }

  return Number(quantidadeLinhas || 0) || fallback;
}

function normalizarTipoLinhaChip(valor) {
  const tipo = normalizarTexto(valor);
  return tipo.includes('porta') ? 'portabilidade' : 'novo';
}

function somarQuantidadeChipsPorTipo(valoresUnitariosChips, tipoLinha) {
  if (!valoresUnitariosChips) return null;

  try {
    const itens = typeof valoresUnitariosChips === 'string'
      ? JSON.parse(valoresUnitariosChips)
      : valoresUnitariosChips;

    if (!Array.isArray(itens)) return null;

    const temTipoPorItem = itens.some(item => item?.tipo_linha || item?.tipo || item?.categoria);
    if (!temTipoPorItem) return null;

    return itens.reduce((acc, item) => (
      normalizarTipoLinhaChip(item?.tipo_linha || item?.tipo || item?.categoria) === tipoLinha
        ? acc + Number(item?.quantidade || 0)
        : acc
    ), 0);
  } catch {
    return null;
  }
}

function quantidadeCategoriaVenda(venda, categoria) {
  const porTipo = categoria === 'chip_novo'
    ? somarQuantidadeChipsPorTipo(venda.valores_unitarios_chips, 'novo')
    : categoria === 'portabilidade'
      ? somarQuantidadeChipsPorTipo(venda.valores_unitarios_chips, 'portabilidade')
      : null;

  if (porTipo !== null) return porTipo;

  const tipoVenda = normalizarTexto(venda.tipo_venda);
  if (categoria === 'chip_novo' && tipoVenda === 'novo') {
    return somarQuantidadeChips(venda.valores_unitarios_chips, venda.quantidade_linhas);
  }

  if (categoria === 'portabilidade' && tipoVenda === 'portabilidade') {
    return somarQuantidadeChips(venda.valores_unitarios_chips, venda.quantidade_linhas);
  }

  return 0;
}

async function listarClientesDoCiclo(usuarioId, ciclo) {
  return knex('clientes')
    .select('id', 'operadora_atual_id')
    .where('criado_por_id', usuarioId)
    .whereRaw('DATE(created_at) >= ?', [ciclo.inicioStr])
    .whereRaw('DATE(created_at) < ?', [ciclo.fimStr]);
}

async function listarVendasDoCiclo(vendedoraId, ciclo) {
  const dataReferencia = "COALESCE(NULLIF(NULLIF(v.data_venda, '0000-00-00'), '1899-11-30'), NULLIF(DATE(v.criado_em), '0000-00-00'), DATE(v.created_at))";

  return knex('vendas as v')
    .leftJoin('tipos_venda as tv', 'v.tipo_venda_id', 'tv.id')
    .leftJoin('servicos as s', 'v.servico_id', 's.id')
    .select(
      'v.id',
      'v.operadora_id',
      'v.quantidade_linhas',
      'v.valores_unitarios_chips',
      'tv.nome as tipo_venda',
      's.nome as servico'
    )
    .where('v.vendedora_id', vendedoraId)
    .whereNot('v.status_funil', 'retorno')
    .whereRaw(`${dataReferencia} >= ?`, [ciclo.inicioStr])
    .whereRaw(`${dataReferencia} < ?`, [ciclo.fimStr]);
}

function vendaPertenceOperadora(venda, operadoraId) {
  return !operadoraId || Number(venda.operadora_id) === Number(operadoraId);
}

function clientePertenceOperadora(cliente, operadoraId) {
  return !operadoraId || Number(cliente.operadora_atual_id) === Number(operadoraId);
}

function classificarVendas(rows, clientes = []) {
  const totais = {
    registro_cliente: clientes.length,
    chip_novo: 0,
    portabilidade: 0,
    internet: 0
  };

  for (const row of rows) {
    const servico = normalizarTexto(row.servico);

    totais.portabilidade += quantidadeCategoriaVenda(row, 'portabilidade');

    if (servico === 'internet') {
      totais.internet += somarQuantidadeChips(row.valores_unitarios_chips, row.quantidade_linhas, 1);
    }

    totais.chip_novo += quantidadeCategoriaVenda(row, 'chip_novo');
  }

  return totais;
}

function calcularValorCampanha(campanha, vendas, clientes) {
  const categoria = campanha.categoria || 'registro_cliente';
  const operadoraId = campanha.operadora_id ? Number(campanha.operadora_id) : null;

  if (categoria === 'registro_cliente') {
    return clientes.filter(cliente => clientePertenceOperadora(cliente, operadoraId)).length;
  }

  return vendas.reduce((acc, venda) => {
    const servico = normalizarTexto(venda.servico);

    if (categoria === 'chip_novo') {
      if (!vendaPertenceOperadora(venda, operadoraId)) {
        return acc;
      }

      return acc + quantidadeCategoriaVenda(venda, 'chip_novo');
    }

    if (categoria === 'portabilidade') {
      if (!vendaPertenceOperadora(venda, operadoraId)) {
        return acc;
      }

      return acc + quantidadeCategoriaVenda(venda, 'portabilidade');
    }

    if (categoria === 'internet' && servico === 'internet') {
      if (!vendaPertenceOperadora(venda, operadoraId)) {
        return acc;
      }

      return acc + somarQuantidadeChips(venda.valores_unitarios_chips, venda.quantidade_linhas, 1);
    }

    return acc;
  }, 0);
}

async function calcularProgresso(usuarioId, ciclo, campanhas = []) {
  const [clientes, vendas] = await Promise.all([
    listarClientesDoCiclo(usuarioId, ciclo),
    listarVendasDoCiclo(usuarioId, ciclo)
  ]);

  const geral = classificarVendas(vendas, clientes);
  const campanhasProgresso = {};

  campanhas.forEach((campanha) => {
    campanhasProgresso[campanha.id] = calcularValorCampanha(campanha, vendas, clientes);
  });

  return {
    geral,
    campanhas: campanhasProgresso
  };
}

function agruparResgatesPorUsuario(resgates = []) {
  return resgates.reduce((acc, resgate) => {
    const usuarioId = Number(resgate.usuario_id);
    const campanhaId = Number(resgate.campanha_id);

    if (!acc[usuarioId]) {
      acc[usuarioId] = new Set();
    }

    acc[usuarioId].add(campanhaId);
    return acc;
  }, {});
}

class CampanhaController {
  async index(req, res) {
    try {
      const campanhas = await Campanha.findAll();
      res.json(campanhas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar campanhas.' });
    }
  }

  async updateBulk(req, res) {
    try {
      const { campanhas } = req.body;
      if (!Array.isArray(campanhas)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array de campanhas.' });
      }

      const invalida = campanhas.find(campanha => campanhaEhGift(campanha) && validarCampanha(campanha));
      if (invalida) {
        return res.status(400).json({ error: validarCampanha(invalida) });
      }

      await Campanha.updateAll(campanhas);
      const updatedCampanhas = await Campanha.findAll();

      res.json({ message: 'Campanhas atualizadas com sucesso.', campanhas: updatedCampanhas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar campanhas.' });
    }
  }

  async store(req, res) {
    try {
      const erro = validarCampanha(req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const campanha = await Campanha.create({
        periodo: req.body.periodo,
        categoria: req.body.categoria,
        target: Number(req.body.target),
        desc: req.body.desc,
        reward: req.body.reward,
        operadora_id: req.body.operadora_id,
        is_gift: true
      });

      res.status(201).json(campanha);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar campanha.' });
    }
  }

  async progresso(req, res) {
    try {
      const vendedoraId = req.usuario.id;
      const cicloDiario = getCiclo('diaria');
      const cicloSemanal = getCiclo('semanal');
      const cicloMensal = getCiclo('mensal');
      const campanhas = await Campanha.findAll();
      const campanhasDiarias = campanhas.filter(campanha => (campanha.periodo || 'diaria') === 'diaria');
      const campanhasSemanais = campanhas.filter(campanha => campanha.periodo === 'semanal');
      const campanhasMensais = campanhas.filter(campanha => campanha.periodo === 'mensal');

      const [progressoDiario, progressoSemanal, progressoMensal] = await Promise.all([
        calcularProgresso(vendedoraId, cicloDiario, campanhasDiarias),
        calcularProgresso(vendedoraId, cicloSemanal, campanhasSemanais),
        calcularProgresso(vendedoraId, cicloMensal, campanhasMensais),
      ]);

      const diaria = progressoDiario.geral;
      const semanal = progressoSemanal.geral;
      const mensal = progressoMensal.geral;
      const resgates = await knex('campanha_resgates')
        .where('usuario_id', vendedoraId)
        .where(builder => {
          builder
            .where(query => {
              query.where('periodo', 'diaria').where('periodo_inicio', cicloDiario.inicioStr);
            })
            .orWhere(query => {
              query.where('periodo', 'semanal').where('periodo_inicio', cicloSemanal.inicioStr);
            })
            .orWhere(query => {
              query.where('periodo', 'mensal').where('periodo_inicio', cicloMensal.inicioStr);
            });
        })
        .pluck('campanha_id');

      res.json({
        diaria_registro_cliente: diaria.registro_cliente,
        diaria_chip_novo: diaria.chip_novo,
        diaria_portabilidade: diaria.portabilidade,
        diaria_internet: diaria.internet,
        semanal_registro_cliente: semanal.registro_cliente,
        semanal_chip_novo: semanal.chip_novo,
        semanal_portabilidade: semanal.portabilidade,
        semanal_internet: semanal.internet,
        mensal_registro_cliente: mensal.registro_cliente,
        mensal_chip_novo: mensal.chip_novo,
        mensal_portabilidade: mensal.portabilidade,
        mensal_internet: mensal.internet,
        campanhas: {
          ...progressoDiario.campanhas,
          ...progressoSemanal.campanhas,
          ...progressoMensal.campanhas
        },
        resgatadas: resgates.map(Number),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao calcular progresso.' });
    }
  }

  async progressoUsuarios(req, res) {
    try {
      const cicloDiario = getCiclo('diaria');
      const cicloSemanal = getCiclo('semanal');
      const cicloMensal = getCiclo('mensal');
      const campanhas = await Campanha.findAll();
      const campanhasGift = campanhas.filter(campanhaEhGift);
      const campanhasDiarias = campanhasGift.filter(campanha => (campanha.periodo || 'diaria') === 'diaria');
      const campanhasSemanais = campanhasGift.filter(campanha => campanha.periodo === 'semanal');
      const campanhasMensais = campanhasGift.filter(campanha => campanha.periodo === 'mensal');
      const usuarios = await knex('usuarios as u')
        .leftJoin('roles as r', 'u.role_id', 'r.id')
        .select(
          'u.id',
          'u.nome',
          'u.email',
          'u.foto_perfil',
          'u.ativo',
          'r.nome as role_nome'
        )
        .where('u.ativo', true)
        .orderBy('u.nome', 'asc');
      const usuarioIds = usuarios.map(usuario => usuario.id);
      const resgates = usuarioIds.length > 0
        ? await knex('campanha_resgates')
          .whereIn('usuario_id', usuarioIds)
          .where(builder => {
            builder
              .where(query => {
                query.where('periodo', 'diaria').where('periodo_inicio', cicloDiario.inicioStr);
              })
              .orWhere(query => {
                query.where('periodo', 'semanal').where('periodo_inicio', cicloSemanal.inicioStr);
              })
              .orWhere(query => {
                query.where('periodo', 'mensal').where('periodo_inicio', cicloMensal.inicioStr);
              });
          })
          .select('usuario_id', 'campanha_id')
        : [];
      const resgatesPorUsuario = agruparResgatesPorUsuario(resgates);

      const usuariosComProgresso = await Promise.all(usuarios.map(async (usuario) => {
        const [progressoDiario, progressoSemanal, progressoMensal] = await Promise.all([
          calcularProgresso(usuario.id, cicloDiario, campanhasDiarias),
          calcularProgresso(usuario.id, cicloSemanal, campanhasSemanais),
          calcularProgresso(usuario.id, cicloMensal, campanhasMensais)
        ]);
        const progressoCampanhas = {
          ...progressoDiario.campanhas,
          ...progressoSemanal.campanhas,
          ...progressoMensal.campanhas
        };
        const campanhasUsuario = campanhasGift.map((campanha) => {
          const current = progressoCampanhas[campanha.id] || 0;
          const target = Number(campanha.target || 0);
          const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
          const achieved = pct >= 100;
          const claimed = resgatesPorUsuario[Number(usuario.id)]?.has(Number(campanha.id)) || false;

          return {
            id: campanha.id,
            periodo: campanha.periodo,
            categoria: campanha.categoria,
            desc: campanha.desc,
            reward: campanha.reward,
            target,
            current,
            pct,
            achieved,
            claimed,
            operadora_id: campanha.operadora_id,
            operadora_nome: campanha.operadora_nome
          };
        });
        const atingidas = campanhasUsuario.filter(campanha => campanha.achieved).length;
        const resgatadas = campanhasUsuario.filter(campanha => campanha.claimed).length;

        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          foto_perfil: usuario.foto_perfil,
          role: { nome: usuario.role_nome },
          campanhas: campanhasUsuario,
          resumo: {
            total: campanhasUsuario.length,
            atingidas,
            pendentes: campanhasUsuario.length - atingidas,
            resgatadas
          }
        };
      }));

      res.json({
        ciclo: {
          diaria: {
            inicio: cicloDiario.inicioStr,
            fim: cicloDiario.fimStr
          },
          semanal: {
            inicio: cicloSemanal.inicioStr,
            fim: cicloSemanal.fimStr
          },
          mensal: {
            inicio: cicloMensal.inicioStr,
            fim: cicloMensal.fimStr
          }
        },
        usuarios: usuariosComProgresso
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao calcular progresso por usuário.' });
    }
  }

  async resgatar(req, res) {
    try {
      const usuarioId = req.usuario.id;
      const campanha = await knex('campanhas').where({ id: req.params.id }).first();

      if (!campanha) {
        return res.status(404).json({ error: 'Campanha não encontrada.' });
      }

      if (!campanhaEhGift(campanha)) {
        return res.status(400).json({ error: 'Esta campanha não possui recompensa para resgate.' });
      }

      const ciclo = getCiclo(campanha.periodo);
      const existente = await knex('campanha_resgates')
        .where({
          usuario_id: usuarioId,
          campanha_id: campanha.id,
          periodo_inicio: ciclo.inicioStr
        })
        .first();

      if (existente) {
        return res.json({
          message: 'Campanha já resgatada neste ciclo.',
          resgatada: true,
          jaResgatada: true,
          campanhaId: campanha.id,
          reward: existente.reward_snapshot || campanha.reward,
          resgate: existente
        });
      }

      const progresso = await calcularProgresso(usuarioId, ciclo, [campanha]);
      const current = progresso.campanhas[campanha.id] ?? progresso.geral[campanha.categoria] ?? 0;
      const target = Number(campanha.target) || 0;

      if (current < target) {
        return res.status(400).json({
          error: 'Campanha ainda não atingida.',
          current,
          target
        });
      }

      const dadosResgate = {
        usuario_id: usuarioId,
        campanha_id: campanha.id,
        periodo: ciclo.periodo,
        periodo_inicio: ciclo.inicioStr,
        periodo_fim: ciclo.fimStr,
        reward_snapshot: campanha.reward || null,
        claimed_at: knex.fn.now(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      };

      let id;
      try {
        [id] = await knex('campanha_resgates').insert(dadosResgate);
      } catch (insertError) {
        if (insertError && insertError.code === 'ER_DUP_ENTRY') {
          const resgateExistente = await knex('campanha_resgates')
            .where({
              usuario_id: usuarioId,
              campanha_id: campanha.id,
              periodo_inicio: ciclo.inicioStr
            })
            .first();

          return res.json({
            message: 'Campanha já resgatada neste ciclo.',
            resgatada: true,
            jaResgatada: true,
            campanhaId: campanha.id,
            reward: resgateExistente?.reward_snapshot || campanha.reward,
            resgate: resgateExistente
          });
        }

        throw insertError;
      }

      const resgate = await knex('campanha_resgates').where({ id }).first();

      res.status(201).json({
        message: 'Campanha resgatada com sucesso.',
        resgatada: true,
        jaResgatada: false,
        campanhaId: campanha.id,
        reward: resgate.reward_snapshot || campanha.reward,
        resgate
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao resgatar campanha.' });
    }
  }

  async destroy(req, res) {
    try {
      const deleted = await Campanha.deleteById(req.params.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Campanha não encontrada.' });
      }

      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir campanha.' });
    }
  }
}

module.exports = new CampanhaController();
