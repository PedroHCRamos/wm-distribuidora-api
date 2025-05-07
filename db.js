const { Pool } = require('pg');
const types = require('pg').types;
require('dotenv').config();

types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;