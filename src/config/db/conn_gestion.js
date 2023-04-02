const { Pool } = require('pg');

const config = {
    host: `${process.env.HOSTSTD}`,
    user: `${process.env.USRSTD}`,
    password: `${process.env.PWDSTD}`,
    database: `${process.env.DBSTD}`,
    port: `${process.env.PORTSTD}`
}

const pool = new Pool(config);

module.exports = pool






