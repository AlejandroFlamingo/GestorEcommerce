const fs = require('fs');
const pool = require(`./db/conn_goe`);

tzoffset = (new Date()).getTimezoneOffset() * 60000;
localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

let insert_log = (tipo_log, data, file)=>{
    try {
        data_log = '['+localISOTime+'] [< '+tipo_log+' >] >> Response: '+JSON.stringify(data)+"\n"// texto que se registra en el log
        fs.writeFile('src/logs/'+file+'.txt', data_log, { flag: 'a+' }, (err) => { err ? console.log(err): "" })// Se registra el log en el archivo log_getstock.txt
    } catch (err) {
        data_log = '['+localISOTime+'] [< '+tipo_log+' >] >> Response: '+JSON.stringify(err.message)+"\n"// texto que se registra en el log
        fs.writeFile('src/logs/'+file+'.txt', data_log, { flag: 'a+' }, (err) => { err ? console.log(err): "" })// Se registra el log en el archivo log_getstock.txt
    }
}

const seguimiento_proceso = async (codigo, msg, estado) => {
    tzoffset = (new Date()).getTimezoneOffset() * 60000;
    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;

    respuest = await pool.query(`
        insert into log_inventario (codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
        values (${codigo}, '0',0,'0',0,0,'${huella}', 0, ${estado}, '${msg}', '0', '0')
        `);
}

module.exports.insert_log = insert_log
module.exports.seguimiento_proceso = seguimiento_proceso
