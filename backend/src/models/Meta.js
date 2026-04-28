const db = require('../database/connection');

class Meta {
  static tableName = 'metas';

  static async findAll() {
    return db(this.tableName).select('*').orderBy('id', 'asc');
  }

  static async updateAll(metasArray) {
    // Para simplificar, faremos um loop em uma transaction
    return db.transaction(async trx => {
      const promises = metasArray.map(meta => {
        const { id, target, desc, reward } = meta;
        return trx(this.tableName)
          .where({ id })
          .update({ target, desc, reward, updated_at: db.fn.now() });
      });
      await Promise.all(promises);
    });
  }
}

module.exports = Meta;
