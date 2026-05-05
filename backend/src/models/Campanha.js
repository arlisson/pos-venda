const db = require('../database/connection');

const PERIODOS_VALIDOS = ['diaria', 'semanal'];
const CATEGORIAS_VALIDAS = ['registro_cliente', 'chip_novo', 'portabilidade', 'internet'];

function montarTipo(periodo, categoria) {
  return `${periodo}_${categoria}`;
}

function isGift(campanha) {
  return campanha.is_gift === true || campanha.is_gift === 1 || campanha.is_gift === '1';
}

function normalizarCampanha(campanha) {
  const periodo = PERIODOS_VALIDOS.includes(campanha.periodo) ? campanha.periodo : 'diaria';
  const categoria = CATEGORIAS_VALIDAS.includes(campanha.categoria) ? campanha.categoria : 'registro_cliente';
  const gift = isGift(campanha);

  return {
    tipo: gift ? montarTipo(periodo, categoria) : (campanha.tipo || 'diaria'),
    periodo,
    categoria,
    target: Number(campanha.target || 0),
    desc: campanha.desc,
    reward: campanha.reward || null,
    is_gift: campanha.is_gift !== undefined ? campanha.is_gift : true,
    operadora_id: campanha.operadora_id ? Number(campanha.operadora_id) : null
  };
}

class Campanha {
  static tableName = 'campanhas';

  static get periodosValidos() {
    return PERIODOS_VALIDOS;
  }

  static get categoriasValidas() {
    return CATEGORIAS_VALIDAS;
  }

  static async findAll() {
    return db(`${this.tableName} as c`)
      .leftJoin('operadoras as o', 'c.operadora_id', 'o.id')
      .select('c.*', 'o.nome as operadora_nome')
      .orderBy('c.id', 'asc');
  }

  static async updateAll(campanhasArray) {
    return db.transaction(async trx => {
      const promises = campanhasArray.map(campanha => {
        const dados = normalizarCampanha(campanha);

        return trx(this.tableName)
          .where({ id: campanha.id })
          .update({
            tipo: dados.tipo,
            periodo: dados.periodo,
            categoria: dados.categoria,
            target: dados.target,
            desc: dados.desc,
            reward: dados.reward,
            operadora_id: dados.operadora_id,
            updated_at: db.fn.now()
          });
      });

      await Promise.all(promises);
    });
  }

  static async create(data) {
    const dados = normalizarCampanha(data);
    const [id] = await db(this.tableName).insert({
      ...dados,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    return db(this.tableName).where({ id }).first();
  }

  static async deleteById(id) {
    return db(this.tableName)
      .where({ id })
      .where('is_gift', true)
      .del();
  }
}

module.exports = Campanha;
