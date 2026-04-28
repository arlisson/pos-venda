const db = require('../database/connection');

const PERIODOS_VALIDOS = ['diaria', 'semanal'];
const CATEGORIAS_VALIDAS = ['registro_cliente', 'chip_novo', 'portabilidade', 'internet'];

function montarTipo(periodo, categoria) {
  return `${periodo}_${categoria}`;
}

function isGift(meta) {
  return meta.is_gift === true || meta.is_gift === 1 || meta.is_gift === '1';
}

function normalizarMeta(meta) {
  const periodo = PERIODOS_VALIDOS.includes(meta.periodo) ? meta.periodo : 'diaria';
  const categoria = CATEGORIAS_VALIDAS.includes(meta.categoria) ? meta.categoria : 'registro_cliente';
  const gift = isGift(meta);

  return {
    tipo: gift ? montarTipo(periodo, categoria) : (meta.tipo || 'diaria'),
    periodo,
    categoria,
    target: Number(meta.target || 0),
    desc: meta.desc,
    reward: meta.reward || null,
    is_gift: meta.is_gift !== undefined ? meta.is_gift : true
  };
}

class Meta {
  static tableName = 'metas';

  static get periodosValidos() {
    return PERIODOS_VALIDOS;
  }

  static get categoriasValidas() {
    return CATEGORIAS_VALIDAS;
  }

  static async findAll() {
    return db(this.tableName).select('*').orderBy('id', 'asc');
  }

  static async updateAll(metasArray) {
    return db.transaction(async trx => {
      const promises = metasArray.map(meta => {
        const dados = normalizarMeta(meta);

        return trx(this.tableName)
          .where({ id: meta.id })
          .update({
            tipo: dados.tipo,
            periodo: dados.periodo,
            categoria: dados.categoria,
            target: dados.target,
            desc: dados.desc,
            reward: dados.reward,
            updated_at: db.fn.now()
          });
      });

      await Promise.all(promises);
    });
  }

  static async create(data) {
    const dados = normalizarMeta(data);
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

module.exports = Meta;
