const { restaurarZerosCnpj } = require('../../services/cnpj.service');

const BATCH = 2000;

/**
 * Verifica se a chave do dados_json carrega um documento (cnpj/cpf), usando a mesma
 * regra de extrairCnpjsLinha no lead-planilha.service.
 */
function ehColunaDocumento(chave) {
  const nome = String(chave || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return nome.includes('cnpj') || nome.includes('documento');
}

/**
 * Conta apenas os digitos de um valor.
 */
function contarDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '').length;
}

/**
 * Restaura os zeros a esquerda dos CNPJs gravados dentro de lead_linhas.dados_json
 * antes da correcao de importacao. So mexe no valor do documento; as colunas de
 * tratamento (envio_id, atribuido_para_id, futuro_cliente, etc.) ficam intactas.
 */
exports.up = async function (knex) {
  let ultimoId = 0;
  let corrigidas = 0;

  for (;;) {
    const linhas = await knex('lead_linhas')
      .where('id', '>', ultimoId)
      .orderBy('id', 'asc')
      .limit(BATCH)
      .select('id', 'dados_json');
    if (!linhas.length) break;

    for (const linha of linhas) {
      ultimoId = linha.id;

      let dados;
      try {
        dados = JSON.parse(linha.dados_json || '{}');
      } catch {
        continue;
      }
      if (!dados || typeof dados !== 'object') continue;

      let mudou = false;
      for (const [chave, valor] of Object.entries(dados)) {
        if (!ehColunaDocumento(chave)) continue;
        // Ja completo ou mascarado (14 digitos): nada a restaurar.
        if (contarDigitos(valor) >= 14) continue;
        const corrigido = restaurarZerosCnpj(valor); // '' para CPF/valor ambiguo
        if (corrigido && corrigido !== String(valor)) {
          dados[chave] = corrigido;
          mudou = true;
        }
      }

      if (mudou) {
        await knex('lead_linhas')
          .where('id', linha.id)
          .update({ dados_json: JSON.stringify(dados) });
        corrigidas += 1;
      }
    }
  }

  console.log(`[migration] CNPJs corrigidos em ${corrigidas} linha(s) de lead_linhas.`);
};

exports.down = async function () {
  // Correcao de dados: sem rollback, pois nao ha como recuperar com seguranca o valor
  // "quebrado" original de cada linha.
};
