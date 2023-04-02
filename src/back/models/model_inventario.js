const logs = require('../../config/logs');
const fetch = require('node-fetch');
const pool = require('../../config/db/conn_goe');
const pool_goe = require('../../config/db/conn_goe');
const oracle = require('oracledb');
const conn_fenixprd = require('../../config/db/conn_oracle');

let model_inventario_config = async () => {

    tzoffset = (new Date()).getTimezoneOffset() * 60000;
    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    fecha_hoy = (localISOTime.split('T'))[0];
    hoy = localISOTime.replace('T',' ');

    conexion = await oracle.getConnection(conn_fenixprd); // Se crea la conexion a la base de datos 

    // cuando se reporta stock a un prodicto se debe cambiar de estado el prodicto en fenix
    // estado 2: estado que indica que el producto esta disponible para reportar stock
    // estado 3: estado que indica que ya fue reportado stock a ese producto

    // consulta de vista xxxxxx para traer ean y stock que corresponde a cada whitelabel de VTEX
    sql_total = `SELECT COUNT(STOCKDISPONIBLE) FROM FENIX_CENTRAL.INVENTARIO_CANALES WHERE ESTADO = 2`;
    resultado_total = await conexion.execute(sql_total, [], { autoCommit: false }); // Se ejecuta consulta a base de datos
    total_registros = resultado_total.rows;
    

    // consulta de vista xxxxxx para traer ean y stock que corresponde a cada whitelabel de VTEX
    sql_total_eanes = `SELECT COUNT(DISTINCT CODIGOEAN) FROM FENIX_CENTRAL.INVENTARIO_CANALES WHERE ESTADO = 2`;
    resultado_total_eanes = await conexion.execute(sql_total_eanes, [], { autoCommit: false }); // Se ejecuta consulta a base de datos
    total_eanes = resultado_total_eanes.rows;

    conexion.release(); // Se libera la conexion a la base de datos

    inicio_sincronizacion = await pool_goe.query(`select * from log_inventario where codigo_proceso = (select max(codigo_proceso) from log_inventario) order by id desc limit 1`)
    data_inicio_sincronizacion = inicio_sincronizacion.rows;
    validacion_sincronizacion_hoy = await pool_goe.query(`select * from log_inventario where codigo_proceso = (select max(codigo_proceso) from log_inventario) order by id desc limit 1`)
    data_validacion_sincronizacion_hoy = validacion_sincronizacion_hoy.rows;
    fin_sincronizacion = await pool_goe.query(`select * from log_inventario where codigo_proceso = (select max(codigo_proceso) from log_inventario) order by id asc limit 1`)
    data_fin_sincronizacion = fin_sincronizacion.rows;
    avance_total = await pool_goe.query(`select count(id) from log_inventario where estado <> 3 and codigo_proceso = (select max(codigo_proceso) from log_inventario) `)
    data_avance_total = avance_total.rows;
    log_seguimiento = await pool_goe.query(`select * from log_inventario where estado = 3 and codigo_proceso = (select max(codigo_proceso) from log_inventario)`)
    data_log_seguimiento = log_seguimiento.rows;

    
    // inicio_sincronizacion = await pool_goe.query(`select * from log_inventario order by id desc limit 1`)
    // data_inicio_sincronizacion = inicio_sincronizacion.rows;
    // fin_sincronizacion = await pool_goe.query(`select * from log_inventario order by id asc limit 1`)
    // data_fin_sincronizacion = fin_sincronizacion.rows;
    // avance_total = await pool_goe.query(`select count(id) from log_inventario where estado <> 3 `)
    // data_avance_total = avance_total.rows;
    // log_seguimiento = await pool_goe.query(`select * from log_inventario where estado = 3 `)
    // data_log_seguimiento = log_seguimiento.rows;



    // si no hay registros de hoy es por que no se a ejecutado el stock -> se debe mostar el modal de ejecucion manual

    // si hay registros de hoy pero hace mas de 30 segundos se registro el ultimo y el total de no procesados es mayor a cero 
    // -> se debe mostrar estado de error y validar cuantos registros falta para ejecutarlos de nuevo

    // si hay registros de hoy pero hace mas de 30 segundos se registro el ultimo y el total de no procesados es cero 
    // -> se muestra modal para ejecutar sincronizacion desde cero (con el total de registros que encuentre en al vista de fenix)

    // si hay registros de hoy pero hace menos de 30 segundos se registro el ultimo y el total de no procesados es mayor cero 
    // -> se muestra boton deshabilitado y estado "procesando..."
    
    // si hay registros de hoy pero hace mas de 30 segundos se registro el ultimo y el total de no procesados es cero 
    // -> se muestra la fecha de ultimo registor de log (esto indica que ya finalizo el proceso)

    response = {
        inicio_sincronizacion: data_inicio_sincronizacion[0] == undefined ? 0 : data_inicio_sincronizacion[0].fecha_registro,
        fin_sincronizacion: data_fin_sincronizacion[0] == undefined ? 0 : data_fin_sincronizacion[0].fecha_registro,
        total_registros: total_registros,
        total_eanes: total_eanes,
        avance_total: (parseInt(data_avance_total[0].count) * 100) / total_registros,
        avance_total_registros: parseInt(data_avance_total[0].count),
        log_seguimiento: data_log_seguimiento
    }

    estado_sincronizacion = ((new Date(localISOTime).getTime()) - (new Date(response.inicio_sincronizacion).getTime()))/1000

    if (data_validacion_sincronizacion_hoy.length == 0) {
        response.estatus = 'Sin Ejecutar'
        console.log(response.estatus);
    } else if(data_validacion_sincronizacion_hoy.length > 0 && estado_sincronizacion > 150 && (response.total_registros - response.avance_total_registros) > 0) {
        response.estatus = 'Error'
        console.log(response.estatus);
    } else if(data_validacion_sincronizacion_hoy.length > 0 && estado_sincronizacion > 30 && (response.total_registros - response.avance_total_registros) == 0) {
        response.estatus = 'Finalizado Exitoso'
        response.estatusDate = (new Date(localISOTime).toLocaleString('en-US',{timeZone: 'America/Lima' }));
    } else if(data_validacion_sincronizacion_hoy.length > 0 && estado_sincronizacion < 150) {
        response.estatus = 'Procesando...'
        console.log(response.estatus);
    } else{
        response.estatus = 'Error'
        console.log(response.estatus);
    }
    
    return response;

}

module.exports.model_inventario_config = model_inventario_config;