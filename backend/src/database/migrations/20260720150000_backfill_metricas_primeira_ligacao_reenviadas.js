/**
 * Recupera a primeira tentativa de leads que foram reenviados antes de o
 * histórico operacional passar a ser preservado na própria linha.
 */
const ACOES_STATUS = {
  'lead_linha.chamada_nao_atendida': 'chamada_nao_atendida',
  'lead_linha.chamada_nao_atendida_admin': 'chamada_nao_atendida',
  'lead_linha.cliente_recusou': 'cliente_recusou',
  'lead_linha.cliente_recusou_admin': 'cliente_recusou',
  'lead_linha.retorno_marcado': 'retorno_agendado',
  'lead_linha.retorno_marcado_admin': 'retorno_agendado'
};

exports.up = async function (knex) {
  const campos = ['primeira_ligacao_status', 'primeira_ligacao_em', 'primeira_ligacao_usuario_id'];
  for (const campo of campos) {
    if (!await knex.schema.hasColumn('lead_linhas', campo)) return;
  }

  const acoes = Object.keys(ACOES_STATUS);
  const auditorias = await knex('audit_logs')
    .whereIn('acao', acoes)
    .where('entidade', 'lead_linhas')
    .orderBy('id', 'asc')
    .select('entidade_id', 'usuario_id', 'acao', 'created_at');
  const primeiraPorLinha = new Map();
  auditorias.forEach(item => {
    const linhaId = Number(item.entidade_id);
    if (linhaId && !primeiraPorLinha.has(linhaId)) primeiraPorLinha.set(linhaId, item);
  });

  const reenviados = await knex('lead_atribuicoes')
    .where('etapa', 'sondagem')
    .groupBy('lead_linha_id')
    .havingRaw('COUNT(*) > 1')
    .pluck('lead_linha_id');

  for (const linhaId of reenviados) {
    const auditoria = primeiraPorLinha.get(Number(linhaId));
    if (!auditoria) continue;
    await knex('lead_linhas')
      .where('id', linhaId)
      .whereNull('primeira_ligacao_status')
      .where(builder => builder
        .whereNull('chamada_nao_atendida').orWhere('chamada_nao_atendida', false))
      .where(builder => builder
        .whereNull('cliente_recusou').orWhere('cliente_recusou', false))
      .whereNull('retorno_agendado_em')
      .update({
        primeira_ligacao_status: ACOES_STATUS[auditoria.acao],
        primeira_ligacao_em: auditoria.created_at,
        primeira_ligacao_usuario_id: auditoria.usuario_id || null
      });
  }
};

// O histórico recuperado não deve ser apagado em um rollback de código.
exports.down = async function () {};