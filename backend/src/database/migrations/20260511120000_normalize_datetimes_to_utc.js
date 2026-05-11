// Subtrai 3h de todos os campos DATETIME do banco, corrigindo timestamps
// gravados em UTC+3 (horário local do servidor) para UTC.
// Contexto: o knex passa a usar timezone: '+00:00', então leituras e escritas
// futuras já serão em UTC. Esta migration alinha os dados históricos.

const OFFSET_HORAS = 3;

const TABELAS = [
  { tabela: 'vendas',                     colunas: ['created_at', 'updated_at', 'excluido_em', 'excluir_definitivo_em', 'enviada_pos_venda_em'] },
  { tabela: 'usuarios',                   colunas: ['created_at', 'updated_at'] },
  { tabela: 'roles',                      colunas: ['created_at', 'updated_at'] },
  { tabela: 'permissoes',                 colunas: ['created_at', 'updated_at'] },
  { tabela: 'audit_logs',                 colunas: ['created_at'] },
  { tabela: 'funil_etapas',              colunas: ['created_at', 'updated_at'] },
  { tabela: 'venda_historicos',           colunas: ['created_at'] },
  { tabela: 'entidade_notas',             colunas: ['created_at', 'updated_at', 'retorno_agendado_em'] },
  { tabela: 'venda_notificacao_parada',   colunas: ['data_entrada_etapa', 'created_at', 'updated_at'] },
  { tabela: 'venda_aprovacao_solicitacoes', colunas: ['created_at', 'updated_at', 'respondido_em'] },
  { tabela: 'cnpj_consultas_cache',       colunas: ['created_at', 'updated_at'] },
  { tabela: 'notificacoes',               colunas: ['created_at', 'updated_at'] },
  { tabela: 'lead_planilhas',             colunas: ['created_at', 'updated_at'] },
  { tabela: 'campanhas',                  colunas: ['created_at', 'updated_at'] },
  { tabela: 'meta_resgates',              colunas: ['created_at', 'updated_at'] },
  { tabela: 'regras_comissao',            colunas: ['created_at', 'updated_at'] },
  { tabela: 'venda_arquivos',             colunas: ['created_at', 'updated_at'] },
  { tabela: 'venda_problemas',            colunas: ['created_at', 'updated_at'] },
  { tabela: 'operadoras',                 colunas: ['created_at', 'updated_at'] },
  { tabela: 'tipos_produto',              colunas: ['created_at', 'updated_at'] },
  { tabela: 'tipos_venda',                colunas: ['created_at', 'updated_at'] },
  { tabela: 'servicos',                   colunas: ['created_at', 'updated_at'] },
  { tabela: 'clientes',                   colunas: ['created_at', 'updated_at'] },
  { tabela: 'links_externos',             colunas: ['created_at', 'updated_at'] },
  { tabela: 'planos',                     colunas: ['created_at', 'updated_at'] },
];

async function ajustarColunas(knex, tabelas, intervalo) {
  for (const { tabela, colunas } of tabelas) {
    const existe = await knex.schema.hasTable(tabela);
    if (!existe) continue;

    for (const coluna of colunas) {
      const temColuna = await knex.schema.hasColumn(tabela, coluna);
      if (!temColuna) continue;

      await knex.raw(
        `UPDATE \`${tabela}\` SET \`${coluna}\` = DATE_ADD(\`${coluna}\`, INTERVAL ? HOUR) WHERE \`${coluna}\` IS NOT NULL`,
        [intervalo]
      );
    }
  }
}

exports.up = async function (knex) {
  await ajustarColunas(knex, TABELAS, -OFFSET_HORAS);
};

exports.down = async function (knex) {
  await ajustarColunas(knex, TABELAS, OFFSET_HORAS);
};
