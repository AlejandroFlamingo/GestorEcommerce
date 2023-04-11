const { Pool } = require('pg');

const config = {
    host: `${process.env.SRVDB_PG}`,
    user: `${process.env.USERDB_PG}`,
    password: `${process.env.PWDDB_PG}`,
    database: `${process.env.NAMEDB_PG}`,
    port: `${process.env.PORTDB_PG}`,
    max: 200
}

const pool = new Pool(config);

module.exports = pool