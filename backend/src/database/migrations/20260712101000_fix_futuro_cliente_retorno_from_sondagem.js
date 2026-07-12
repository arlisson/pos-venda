exports.up = async function (knex) {
  await knex.raw(`
    UPDATE lead_linhas ll
    INNER JOIN lead_sondagens ls ON ls.lead_linha_id = ll.id
    SET
      ll.futuro_cliente_retorno = ls.retorno_em,
      ll.futuro_cliente_marcado_em = COALESCE(NULLIF(ll.futuro_cliente_marcado_em, '0000-00-00 00:00:00'), ls.respondido_em),
      ll.updated_at = CURRENT_TIMESTAMP
    WHERE ll.futuro_cliente = 1
      AND (
        ll.futuro_cliente_retorno IS NULL
        OR ll.futuro_cliente_retorno = '0000-00-00 00:00:00'
      )
      AND ls.retorno_em IS NOT NULL
  `);
};

exports.down = async function () {};
