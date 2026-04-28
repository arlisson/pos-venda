/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('metas').del();
  await knex('metas').insert([
    { tipo: 'diaria', target: 15, desc: 'Meta Diária Global', reward: null, is_gift: false },
    { tipo: 'clientes', target: 5, desc: 'Cadastrar 5 clientes', reward: 'Vale iFood R$ 50', is_gift: true },
    { tipo: 'chips', target: 10, desc: 'Vender 10 chips novos', reward: 'Pix R$ 20', is_gift: true },
    { tipo: 'port_vivo', target: 3, desc: 'Fazer 3 portabilidades vivo', reward: 'Meio período de folga', is_gift: true },
    { tipo: 'port_claro', target: 3, desc: 'Fazer 3 portabilidades claro', reward: 'Vale Uber R$ 30', is_gift: true },
    { tipo: 'negociacoes', target: 5, desc: 'Realizar 5 negociações', reward: '1 Ingresso de Cinema', is_gift: true }
  ]);
};
