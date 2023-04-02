const { Worker, parentPort, workerData } = require('worker_threads');

const oracle = require('oracledb');
const pool = require('../../../config/db/conn_goe');
const conn_fenixprd = require('../../../config/db/conn_oracle');
const log_proceso = require(`../../../config/logs`);

const codigo_proceso = workerData.codigo;
console.log('***************************************');
console.log('***************************************');
console.log('***************************************');
console.log('***************************************');
console.log(codigo_proceso);
console.log('***************************************');
console.log('***************************************');
console.log('***************************************');
console.log('***************************************');

// datos_logs = data_logs.data
// console.log(datos_logs);
// console.log(datos_logs.length);

/**
 * 0 - Consulta de las credenciales para consumir servicios de vtex
 * 1 - consultar vista con stock asignado para vtex
 * 2 - consultar sku por ean (se consulta informacion en la maestra)
 * 3 - reportar sotck (el array se divide en 10 array para ejecutarlo en 10 subprocesos en paralelo)
 * 4 - Notificar a fenix el reporte de stosk exitosos
 */
const ejecutar = async () => {

    tzoffset = (new Date()).getTimezoneOffset() * 60000;
    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

    log_proceso.seguimiento_proceso(codigo_proceso, 'Se ejecuto el subproceso principal', 3);

    //*************** se consultan los keys de VTEX registrados en el gestor ****************
    const keysvtex = async () => {
        respuest = await pool.query(`
        select distinct k.store, k.apikey, k.apitoken, t.idvtex, t.idsistemacomercial
        from keysvtex k
        inner join tiendas t on t.id = k.idtienda
        `);
        log_proceso.seguimiento_proceso(codigo_proceso, 'Se consultaron en el gestor las keys de los white-labels de vtex', 3);
        return respuest.rows
    }
    data_keys = await keysvtex();

    const removeDuplicateKeys = (arr) => {
        const uniqueObj = {};
        const uniqueArr = [];

        arr.forEach(obj => {
            if (!uniqueObj[obj.store]) {
                uniqueObj[obj.store] = true;
                uniqueArr.push(obj);
            }
        });

        return uniqueArr;
    }
    keys_unicos = removeDuplicateKeys(data_keys);
    //************************************ Fin *********************************************

    //*************** Se consulta en FENIX la informacion del inventario ****************
    const sql = `SELECT IDSUCURSAL, ESTADO, CODIGOEAN, STOCKDISPONIBLE FROM FENIX_CENTRAL.INVENTARIO_CANALES WHERE ESTADO = :estado`;
    const binds = { estado: 2 };
    const options = { outFormat: oracle.OUT_FORMAT_OBJECT };
    const pool_connect = await oracle.createPool(conn_fenixprd);
    let connection;
    //let skus;
    try {
        connection = await pool_connect.getConnection();
        const result = await connection.execute(sql, binds, options);
        skus = result.rows;
        // console.log(skus);
        log_proceso.seguimiento_proceso(codigo_proceso, 'Finalizo la consulta a FENIX por el inventario (vista FENIX_CENTRAL.INVENTARIO_CANALES)', 3);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
        await pool_connect.close();
    }
    //************************************ Fin *********************************************

    //*************** se buscan eanes en la maestra de productos del gestor ****************
    const valores_ean = skus.map(item => item.CODIGOEAN);
    const unico_ean = [...new Set(valores_ean)];
    const slq_homologados = ` SELECT ean, sku_vtex FROM maestra_productos WHERE ean IN ( SELECT unnest($1::text[]) ) `;
    const result = await pool.query(slq_homologados, [unico_ean]);
    const lista_skus = result.rows;
    // console.log(lista_skus);
    log_proceso.seguimiento_proceso(codigo_proceso, 'Finalizo la consulta de eanes en la maestra de productos del gestor', 3);
    //************************************ Fin *********************************************

    //*************** se identifican los eanes que no estan registrados en la maestra del gestor ****************
    // console.log('cantidad eanes: '+lista_skus.length);
    unico_ean_homologacion = [];
    for (let i = 0; i < lista_skus.length; i++) {
        if (!unico_ean_homologacion.includes(lista_skus[i].ean)) {
            unico_ean_homologacion.push(parseInt(lista_skus[i].ean));
        }
    }
    let sin_sku = unico_ean.filter(codigo => !unico_ean_homologacion.includes(codigo));
    unico_ean_homologacion = sin_sku.map(item => { return { ean: `${item}`, sku_vtex: 0 } });
    // console.log(unico_ean_homologacion);
    log_proceso.seguimiento_proceso(codigo_proceso, `Se identificaron ${unico_ean_homologacion.length} EANs que no estan registrados en la maestra`, 3);
    //************************************ Fin *********************************************

    //*************** funcion que relaiza el cruce de toda la informacion ****************
    log_seguimiento = await pool.query(`select ean, sucursal from log_inventario where estado in (0,1,2) and codigo_proceso = (select max(codigo_proceso) from log_inventario) `)
    datos_logs = log_seguimiento.rows;
    // datos_logs = data_logs.data
    // console.log(datos_logs)

    cruce_data_sku = (lista_skus, inventario, keys_unicos) => {
        huella_inventario = (localISOTime.split('T'))[0].split('-');
        let lista_skus_ordenada = lista_skus.sort((a, b) => a.ean - b.ean); //Ordenamos la lista de skus para usar busqueda binaria
        let result = [];

        inventario.forEach(skus => {
            let indice_buscado = binarySearch(lista_skus_ordenada, skus.CODIGOEAN); //Buscamos el índice del elemento que coincida con el sku actual usando busqueda binaria

            if (indice_buscado !== undefined) { //Si hay un índice coincidente, entonces se agrega el elemento al inventario
                let elemento = {
                    ean: skus.CODIGOEAN,
                    sku_vtex: lista_skus_ordenada[indice_buscado].sku_vtex,
                    sucursal: skus.IDSUCURSAL,
                    stock: skus.STOCKDISPONIBLE,
                    fecha_inventario: `${huella_inventario[0]},${huella_inventario[1]},${huella_inventario[2]}`
                }

                keys_unicos.find((item1) => { //Buscamos los _logs de la tienda en keys unicos

                    if (parseInt(item1.idsistemacomercial) == skus.IDSUCURSAL) {
                        elemento['store'] = item1.store;
                        elemento['apikey'] = item1.apikey;
                        elemento['apitoken'] = item1.apitoken;
                        elemento['idvtex'] = item1.idvtex;
                        elemento['idsistemacomercial'] = item1.idsistemacomercial;
                    }

                });

                result.push(elemento);
            }
        });

        //Funcion BinarySearch: 
        function binarySearch(lista, valor) {   //Recibe un array ordenado y el valor a buscar dentro del array ordenado
            let inicio = 0; //Inicializamos el inicio de la busqueda en 0
            let fin = lista.length - 1; //Inicializamos el final de la busqueda en el ultimo elemento del array

            while (inicio <= fin) {  //Mientras que no hayamos encontrado el elemento, seguimos recorriendo el array
                let medio = Math.floor((inicio + fin) / 2);  //Calculamos la posicion del elemento del medio

                if (lista[medio].ean == valor) {  //Si la posicion del medio es igual al valor que estamos buscando devolvemos la posicion
                    return medio;
                } else if (lista[medio].ean < valor) {  //Si el valor es mayor al valor del medio, cambiamos el inicio a una posicion mayor al medio
                    inicio = medio + 1;
                } else {   //Si el valor es menor al valor del medio, cambiamos el fin a una posicion menor al medio
                    fin = medio - 1;
                }
            }

            return undefined;  // Si no se encuentra el elemento, devolvemos undefined
        }

        return result;
    }
    noSkuSucursal = (inventario, logs) => {
        result = [];
        contador = 0;
        for (let i = 0; i < inventario.length; i++) {
            for (let f = 0; f < logs.length; f++) {
                if (inventario.CODIGOEAN != log[f].ean && inventario.IDSUCURSAL != log[f].sucursal) {
                    //result.push(inventario[i]);
                    result[contador] = inventario[i];
                    contador++
                }
            }
        }
        return result;
    }
    function resultadoInventario(inventario, logs) {
        let result = [];

        inventario.forEach(item => {
            let coincide = false;

            logs.forEach(log => {
                if (item[0] === log.sucursal && item.CODIGOEAN === log.ean) {
                    coincide = true;
                }
            });

            if (!coincide) {
                result.push(item);
            }
        });

        return result;
    }

    sku_final = resultadoInventario(skus, datos_logs);

    //console.log(sku_final);

    productos_con_sku = cruce_data_sku(lista_skus, sku_final, keys_unicos); // registros con sku, estan listos para divir y enviar a los subrocesos para rerpotar stock
    productos_sin_sku = cruce_data_sku(unico_ean_homologacion, sku_final, keys_unicos); // registros que se ejecutan en el subproceso de busqueda de sku

    console.log(productos_con_sku.length);
    console.log(productos_sin_sku.length);

    log_proceso.seguimiento_proceso(codigo_proceso, `Finalizo el cruce de informacion entre "keyvtex" (gestor), "INVENTARIO_CANALES" (fenix), "maestra_productos" (gestor)`, 3);
    //************************************ Fin *********************************************

    //*************** SIN SKU se lanza sumproceso para hacer la busqueda del sku de los productos que no estan en la maestra del gestor ****************
    let numeroDePartes_sin_sku = 20;
    let longitudDeParte_sin_sku = Math.ceil(productos_sin_sku.length / numeroDePartes_sin_sku);
    let arrayDividido_sin_sku = [];
    for (let i = 0; i < numeroDePartes_sin_sku; i++) {
        let desordenado = productos_sin_sku.slice().sort(() => Math.random() - 0.5);
        let nuevaParte = desordenado.slice(i * longitudDeParte_sin_sku, (i + 1) * longitudDeParte_sin_sku);
        arrayDividido_sin_sku.push(nuevaParte);
    }
    log_proceso.seguimiento_proceso(codigo_proceso, `Se realizo la segmentacion de informacion que se ejecutara en cada subproceso`, 3);
    //************************************ Fin *********************************************

    //****************** SIN SKU se dividen los registros en partes (40 partes) ********************
    // Crear el subproceso y pasarle el codigo que identifica el proceso
    const workers_sin_sku = [];
    for (let t = 0; t < arrayDividido_sin_sku.length; t++) {
        const process_code_sin_sku = {
            codigo: codigo_proceso,
            subproceso: 99,
            eanes: arrayDividido_sin_sku[t],
            keys: {
                key: process.env.VTEX_KEY,
                token: process.env.VTEX_TOKEN,
                cuenta: process.env.VTEX_CUENTA
            }
        };
        workers_sin_sku[t] = new Worker(__dirname + '/worker_sku_vtex.js', { workerData: process_code_sin_sku });

    }
    //************************************ Fin *********************************************

    //*************** CON SKU se dividen los registros en partes (40 partes) ****************
    let numeroDePartes = 60;
    let longitudDeParte = Math.ceil(productos_con_sku.length / numeroDePartes);
    let arrayDividido = [];
    for (let i = 0; i < numeroDePartes; i++) {
        let desordenado = productos_con_sku.slice().sort(() => Math.random() - 0.5);
        let nuevaParte = desordenado.slice(i * longitudDeParte, (i + 1) * longitudDeParte);
        arrayDividido.push(nuevaParte);
    }
    log_proceso.seguimiento_proceso(codigo_proceso, `Se realizo la segmentacion de informacion que se ejecutara en cada subproceso`, 3);
    //************************************ Fin *********************************************

    //****************** CON SKU se dividen los registros en partes (40 partes) ********************
    // Crear el subproceso y pasarle el codigo que identifica el proceso
    const workers = [];
    for (let t = 0; t < arrayDividido.length; t++) {
        const process_code = { codigo: codigo_proceso, subproceso: t, datos_inventario: arrayDividido[t] };
        workers[t] = new Worker(__dirname + '/worker_sincronizacion_inventario.js', { workerData: process_code });

    }
    //************************************ Fin *********************************************




}

ejecutar();