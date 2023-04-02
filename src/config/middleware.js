const fs = require('fs');

tzoffset = (new Date()).getTimezoneOffset() * 60000;
localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

let autenticacion = (key, token)=>{
    try {
        return (key === process.env.APIKEY)&&(token === process.env.APITOKEN)
    } catch (err) {
        data_log = '['+localISOTime+'] [< '+tipo_log+' >] >> Response: '+JSON.stringify(err.message)+"\n"// texto que se registra en el log
        fs.writeFile('src/logs/'+file+'.txt', data_log, { flag: 'a+' }, (err) => { err ? console.log(err): "" })// Se registra el log en el archivo log_getstock.txt
    }
}

let errors = {
    400: "Bad request",
    404: "Not Found"
}

module.exports.autenticacion = autenticacion;