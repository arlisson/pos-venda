const knex = require('knex');
const { AjvValidator, Model } = require('objection');

require('dotenv').config();

const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';

const connection = knex(knexConfig[environment]);

Model.createValidator = () => new AjvValidator({
  options: {
    allErrors: true,
    validateSchema: true,
    ownProperties: true,
    allowUnionTypes: true
  }
});

Model.knex(connection);

module.exports = connection;
