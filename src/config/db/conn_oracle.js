config_conect = {// Se crea la conexion a la base de datos
   user: `${process.env.USERDB_ORCACLE}`,
   password: `${process.env.PWDDB_ORCACLE}`,
   connectString: `${process.env.STRING_ORCACLE}`
}


/*
config_conect = {// Se crea la conexion a la base de datos
   user: `FENIX_CENTRAL`,
   password: `F3n1xC3ntr4lPr0d`,
   connectString: `flamvm01-scan1.flamingo.com.co:1521/fenixprd`
}
*/

module.exports = config_conect;
