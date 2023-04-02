
const logs = require('../../../config/logs');
const fetch = require('node-fetch');
const oracle = require('oracledb');
const pool = require('../../../config/db/conn_goe');
const conn_fenixprd = require('../../../config/db/conn_oracle');
const fork = require('child_process').fork;


process.on("message", async (data_logs) => {
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

    tzoffset = (new Date()).getTimezoneOffset() * 60000;
    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

    seguimiento_proceso = async (msg) => {
        tzoffset = (new Date()).getTimezoneOffset() * 60000;
        localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
        huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;

        respuest = await pool.query(`
        insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
        values ('0',0,'0',0,0,'${huella}', 0, 3, '${msg}', 'xxxxxxxxxx', 'xxxxxxxxxx')
        `);
    }

    seguimiento_proceso('Se ejecuto el subproceso principal');

    //*************** se consultan los keys de VTEX registrados en el gestor ****************
    const keysvtex = async () => {
        respuest = await pool.query(`
        select distinct k.store, k.apikey, k.apitoken, t.idvtex, t.idsistemacomercial
        from keysvtex k
        inner join tiendas t on t.id = k.idtienda
        `);
        seguimiento_proceso('Se consultaron en el gestor las keys de los white-labels de vtex');
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
    sql = `SELECT IDSUCURSAL, ESTADO, CODIGOEAN, STOCKDISPONIBLE FROM FENIX_CENTRAL.INVENTARIO_CANALES WHERE ESTADO = 2`;
    conexion = await oracle.getConnection(conn_fenixprd); // Se crea la conexion a la base de _logs 
    resultado = await conexion.execute(sql, [], { autoCommit: false }); // Se ejecuta consulta a base de _logs
    conexion.release(); // Se libera la conexion a la base de _logs
    skus = resultado.rows;
    // console.log(skus);
    seguimiento_proceso('Finalizo la consulta a FENIX por el inventario (vista FENIX_CENTRAL.INVENTARIO_CANALES)');
    //************************************ Fin *********************************************


    //*************** se buscan eanes en la maestra de productos del gestor ****************
    valores_ean = skus.map(item => item[2]);
    unico_ean = [...new Set(valores_ean)]; // lista de eanes con inventario consultados en la vista de fenix (se eliminan enaes repetidos)

    respuest = await pool.query(`
            select ean, sku_vtex
            from maestra_productos
            where ean in (${"'" + unico_ean.join("', '") + "'"})
        `);
    lista_skus = respuest.rows;
    seguimiento_proceso('Finalizo la consulta de eanes en la maestra de productos del gestor');
    //************************************ Fin *********************************************


    //*************** se identifican los eanes que no estan registrados en la maestra del gestor ****************
    unico_ean_homologacion = [];
    for (let i = 0; i < lista_skus.length; i++) {
        if (!unico_ean_homologacion.includes(lista_skus[i].ean)) {
            unico_ean_homologacion.push(parseInt(lista_skus[i].ean));
        }
    }
    let sin_sku = unico_ean.filter(codigo => !unico_ean_homologacion.includes(codigo));
    unico_ean_homologacion = sin_sku.map(item => { return { ean: `${item}`, sku_vtex: 0 } });
    //************************************ Fin *********************************************


    //*************** funcion que relaiza el cruce de toda la informacion ****************
    datos_logs = data_logs.data

    cruce_data_sku = (lista_skus, skus, keys_unicos) => {
        huella_inventario = (localISOTime.split('T'))[0].split('-');
        inventario = [];
        cont = 0;
        let lista_skus_ordenada = lista_skus.sort((a, b) => a.ean - b.ean); //Ordenamos la lista de skus para usar busqueda binaria
        for (let j = 0; j < skus.length; j++) {
            let indice_buscado = binarySearch(lista_skus_ordenada, skus[j][2]); //Buscamos el índice del elemento que coincida con el sku actual usando busqueda binaria

            if (indice_buscado != undefined) { //Si hay un índice coincidente, entonces se agrega el elemento al inventario
                let elemento = {
                    ean: skus[j][2],
                    sku_vtex: lista_skus_ordenada[indice_buscado].sku_vtex,
                    sucursal: skus[j][0],
                    stock: skus[j][3],
                    fecha_inventario: `${huella_inventario[0]},${huella_inventario[1]},${huella_inventario[2]}`
                }

                keys_unicos.find((item1) => { //Buscamos los _logs de la tienda en keys unicos

                    if (parseInt(item1.idsistemacomercial) == skus[j][0]) {
                        elemento['store'] = item1.store;
                        elemento['apikey'] = item1.apikey;
                        elemento['apitoken'] = item1.apitoken;
                        elemento['idvtex'] = item1.idvtex;
                        elemento['idsistemacomercial'] = item1.idsistemacomercial;
                    }

                });

                inventario.push(elemento);
                //console.log(elemento)
            }
        }
        return inventario;
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
    }

    noSkuSucursal = (inventario, logs) => {
        result = [];
        contador = 0;
        for (let i = 0; i < inventario.length; i++) {
            for (let f = 0; f < logs.length; f++) {
                if (inventario[i][2] != log[f].ean && inventario[i][0] != log[f].sucursal) {
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
                if (item[0] === log.sucursal && item[2] === log.ean) {
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
    console.log(sku_final);
    console.log(sku_final.length);

    // datos_logs = data_logs.data
    // console.log(datos_logs);
    // console.log(datos_logs.length);

    productos_con_sku = cruce_data_sku(lista_skus, sku_final, keys_unicos); // registros con sku, estan listos para divir y enviar a los subrocesos para rerpotar stock
    productos_sin_sku = cruce_data_sku(unico_ean_homologacion, sku_final, keys_unicos); // registros que se ejecutan en el subproceso de busqueda de sku


    seguimiento_proceso('Finalizo el cruce de informacion entre "keyvtex" (gestor), "INVENTARIO_CANALES" (fenix), "maestra_productos" (gestor) se genero el objeto con la informacion completa');
    //************************************ Fin *********************************************


    //*************** se lanza sumproceso para hacer la busqueda del sku de los productos que no estan en la maestra del gestor ****************
    data_fork1 = {
        eanes: productos_sin_sku,
        keys: {
            key: process.env.VTEX_KEY,
            token: process.env.VTEX_TOKEN,
            cuenta: process.env.VTEX_CUENTA
        }
    }
    ean_sin_sku = fork(__dirname + '/consulta_sku_vtex.js');
    ean_sin_sku.send(data_fork1);
    //************************************ Fin *********************************************

    //*************** se dividen los registros en partes (40 partes) ****************
    let numeroDePartes = 40;
    let longitudDeParte = Math.ceil(productos_con_sku.length / numeroDePartes);
    let arrayDividido = [];
    for (let i = 0; i < numeroDePartes; i++) {
        let desordenado = productos_con_sku.slice().sort(() => Math.random() - 0.5);
        let nuevaParte = desordenado.slice(i * longitudDeParte, (i + 1) * longitudDeParte);
        arrayDividido.push(nuevaParte);
    }
    seguimiento_proceso('Se realizo la segmentacion de informacion que se ejecutara en cada subproceso');
    //************************************ Fin *********************************************


    //*************** se lanzan los subprocesos con los eanes que si tinen sku ****************
    inventario_proceso_1 = { data: arrayDividido[0] };
    subproceso_1 = fork(__dirname + '/subproceso_1.js');
    subproceso_1.send(inventario_proceso_1);

    inventario_proceso_2 = { data: arrayDividido[1] };
    subproceso_2 = fork(__dirname + '/subproceso_2.js');
    subproceso_2.send(inventario_proceso_2);

    inventario_proceso_3 = { data: arrayDividido[2] };
    subproceso_3 = fork(__dirname + '/subproceso_3.js');
    subproceso_3.send(inventario_proceso_3);

    inventario_proceso_4 = { data: arrayDividido[3] };
    subproceso_4 = fork(__dirname + '/subproceso_4.js');
    subproceso_4.send(inventario_proceso_4);

    inventario_proceso_5 = { data: arrayDividido[4] };
    subproceso_5 = fork(__dirname + '/subproceso_5.js');
    subproceso_5.send(inventario_proceso_5);

    inventario_proceso_6 = { data: arrayDividido[5] };
    subproceso_6 = fork(__dirname + '/subproceso_6.js');
    subproceso_6.send(inventario_proceso_6);

    inventario_proceso_7 = { data: arrayDividido[6] };
    subproceso_7 = fork(__dirname + '/subproceso_7.js');
    subproceso_7.send(inventario_proceso_7);

    inventario_proceso_8 = { data: arrayDividido[7] };
    subproceso_8 = fork(__dirname + '/subproceso_8.js');
    subproceso_8.send(inventario_proceso_8);

    inventario_proceso_9 = { data: arrayDividido[8] };
    subproceso_9 = fork(__dirname + '/subproceso_9.js');
    subproceso_9.send(inventario_proceso_9);

    inventario_proceso_10 = { data: arrayDividido[9] };
    subproceso_10 = fork(__dirname + '/subproceso_10.js');
    subproceso_10.send(inventario_proceso_10);

    inventario_proceso_11 = { data: arrayDividido[10] };
    subproceso_11 = fork(__dirname + '/subproceso_11.js');
    subproceso_11.send(inventario_proceso_11);

    inventario_proceso_12 = { data: arrayDividido[11] };
    subproceso_12 = fork(__dirname + '/subproceso_12.js');
    subproceso_12.send(inventario_proceso_12);

    inventario_proceso_13 = { data: arrayDividido[12] };
    subproceso_13 = fork(__dirname + '/subproceso_13.js');
    subproceso_13.send(inventario_proceso_13);

    inventario_proceso_14 = { data: arrayDividido[13] };
    subproceso_14 = fork(__dirname + '/subproceso_14.js');
    subproceso_14.send(inventario_proceso_14);

    inventario_proceso_15 = { data: arrayDividido[14] };
    subproceso_15 = fork(__dirname + '/subproceso_15.js');
    subproceso_15.send(inventario_proceso_15);

    inventario_proceso_16 = { data: arrayDividido[15] };
    subproceso_16 = fork(__dirname + '/subproceso_16.js');
    subproceso_16.send(inventario_proceso_16);

    inventario_proceso_17 = { data: arrayDividido[16] };
    subproceso_17 = fork(__dirname + '/subproceso_17.js');
    subproceso_17.send(inventario_proceso_17);

    inventario_proceso_18 = { data: arrayDividido[17] };
    subproceso_18 = fork(__dirname + '/subproceso_18.js');
    subproceso_18.send(inventario_proceso_18);

    inventario_proceso_19 = { data: arrayDividido[18] };
    subproceso_19 = fork(__dirname + '/subproceso_19.js');
    subproceso_19.send(inventario_proceso_19);

    inventario_proceso_20 = { data: arrayDividido[19] };
    subproceso_20 = fork(__dirname + '/subproceso_20.js');
    subproceso_20.send(inventario_proceso_20);

    inventario_proceso_21 = { data: arrayDividido[20] };
    subproceso_21 = fork(__dirname + '/subproceso_21.js');
    subproceso_21.send(inventario_proceso_21);

    inventario_proceso_22 = { data: arrayDividido[21] };
    subproceso_22 = fork(__dirname + '/subproceso_22.js');
    subproceso_22.send(inventario_proceso_22);

    inventario_proceso_23 = { data: arrayDividido[22] };
    subproceso_23 = fork(__dirname + '/subproceso_23.js');
    subproceso_23.send(inventario_proceso_23);

    inventario_proceso_24 = { data: arrayDividido[23] };
    subproceso_24 = fork(__dirname + '/subproceso_24.js');
    subproceso_24.send(inventario_proceso_24);

    inventario_proceso_25 = { data: arrayDividido[24] };
    subproceso_25 = fork(__dirname + '/subproceso_25.js');
    subproceso_25.send(inventario_proceso_25);

    inventario_proceso_26 = { data: arrayDividido[25] };
    subproceso_26 = fork(__dirname + '/subproceso_26.js');
    subproceso_26.send(inventario_proceso_26);

    inventario_proceso_27 = { data: arrayDividido[26] };
    subproceso_27 = fork(__dirname + '/subproceso_27.js');
    subproceso_27.send(inventario_proceso_27);

    inventario_proceso_28 = { data: arrayDividido[27] };
    subproceso_28 = fork(__dirname + '/subproceso_28.js');
    subproceso_28.send(inventario_proceso_28);

    inventario_proceso_29 = { data: arrayDividido[28] };
    subproceso_29 = fork(__dirname + '/subproceso_29.js');
    subproceso_29.send(inventario_proceso_29);

    inventario_proceso_30 = { data: arrayDividido[29] };
    subproceso_30 = fork(__dirname + '/subproceso_30.js');
    subproceso_30.send(inventario_proceso_30);

    inventario_proceso_31 = { data: arrayDividido[30] };
    subproceso_31 = fork(__dirname + '/subproceso_31.js');
    subproceso_31.send(inventario_proceso_31);

    inventario_proceso_32 = { data: arrayDividido[31] };
    subproceso_32 = fork(__dirname + '/subproceso_32.js');
    subproceso_32.send(inventario_proceso_32);

    inventario_proceso_33 = { data: arrayDividido[32] };
    subproceso_33 = fork(__dirname + '/subproceso_33.js');
    subproceso_33.send(inventario_proceso_33);

    inventario_proceso_34 = { data: arrayDividido[33] };
    subproceso_34 = fork(__dirname + '/subproceso_34.js');
    subproceso_34.send(inventario_proceso_34);

    inventario_proceso_35 = { data: arrayDividido[34] };
    subproceso_35 = fork(__dirname + '/subproceso_35.js');
    subproceso_35.send(inventario_proceso_35);

    inventario_proceso_36 = { data: arrayDividido[35] };
    subproceso_36 = fork(__dirname + '/subproceso_36.js');
    subproceso_36.send(inventario_proceso_36);

    inventario_proceso_37 = { data: arrayDividido[36] };
    subproceso_37 = fork(__dirname + '/subproceso_37.js');
    subproceso_37.send(inventario_proceso_37);

    inventario_proceso_38 = { data: arrayDividido[37] };
    subproceso_38 = fork(__dirname + '/subproceso_38.js');
    subproceso_38.send(inventario_proceso_38);

    inventario_proceso_39 = { data: arrayDividido[38] };
    subproceso_39 = fork(__dirname + '/subproceso_39.js');
    subproceso_39.send(inventario_proceso_39);

    inventario_proceso_40 = { data: arrayDividido[39] };
    subproceso_40 = fork(__dirname + '/subproceso_40.js');
    subproceso_40.send(inventario_proceso_40);

    //************************************ Fin *********************************************




});