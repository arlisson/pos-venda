exports.up = async function () {
  // Migration restaurada para manter a lista do Knex consistente.
  // O schema atual nao depende mais de campos de contexto de retorno em venda_arquivos.
};

exports.down = async function () {
  // No-op intencional.
};
