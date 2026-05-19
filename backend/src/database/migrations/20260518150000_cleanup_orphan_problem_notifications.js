exports.up = async function (knex) {
  await knex.raw(`
    UPDATE notificacoes n
    LEFT JOIN venda_problemas vp
      ON vp.id = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(n.source_key, ':', 3), ':', -1) AS UNSIGNED)
    SET n.ativa = false, n.updated_at = NOW()
    WHERE n.ativa = true
      AND n.tipo IN ('venda_problema_aberto', 'venda_problema_correcao')
      AND vp.id IS NULL
  `);
};

exports.down = async function () {};
