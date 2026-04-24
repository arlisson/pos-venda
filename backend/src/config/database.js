const knex = require('knex');
const { Model } = require('objection');

require('dotenv').config();

const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';

const connection = knex(knexConfig[environment]);

Model.knex(connection);

module.exports = connection;