const { workerData } = require('worker_threads');
const fetch = require('node-fetch');
const pool_goe = require('../../../config/db/conn_goe');


console.log('*************************************');
console.log('*************************************');
console.log('*************************************');
console.log('*************************************');
console.log('*************************************');
console.log('************ Se ejecuto *************');
console.log('*************************************');
console.log('*************************************');
console.log('*************************************');
console.log('*************************************');
console.log('*************************************');


ejecutar = async () => {

    codigo = workerData.codigo;
    id_subproceso = workerData.subproceso;
    respuest = '';
    respuesta = '';
    hoy = new Date();
    lista_data = [];
    si = [];
    cont_si = 0;
    no = [];
    cont_no = 0;
    data = workerData.eanes
    keys = workerData.keys

    //fs.writeFile(__dirname + '../../../../logs/' + process.env.LOGFILE + '.txt', JSON.stringify(data), { flag: 'a+' }, (err) => { err ? console.log(err) : "" })// Se registra el log en el archivo log_getstock.txt

    function agruparPorEanes(dato) {
        let eanes = [];
        let resultado = [];

        for (let i = 0; i < dato.length; i++) {
            if (!eanes.includes(dato[i].ean)) {
                eanes.push(dato[i].ean);
            }
        }

        for (let j = 0; j < eanes.length; j++) {
            let registros = [];

            for (let k = 0; k < dato.length; k++) {
                if (eanes[j] === dato[k].ean) {
                    registros.push(dato[k]);
                }
            }

            resultado.push({ ean: eanes[j], registros: registros });
        }

        return resultado;
    }

    data_procesada = agruparPorEanes(data)


    for (let i = 0; i < data_procesada.length; i++) {
        const options1 = {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VTEX-API-AppKey': `${keys.key}`,
                'X-VTEX-API-AppToken': `${keys.token}`
            }
        };
        try {
            get_sku = await fetch(`https://${keys.cuenta}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/stockkeepingunitbyean/${data_procesada[i].ean}`, options1);
            respuesta_sku = await get_sku.json();
        } catch (error) {
            console.log(error);
        }
        if (respuesta_sku.Id == undefined) {

            for (let t = 0; t < (data_procesada[i].registros).length; t++) {
                tzoffset = (new Date()).getTimezoneOffset() * 60000;
                localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                try {
                    const client = await pool_goe.connect();
                    try {
                        await client.query('BEGIN');
                        respuest = await client.query(`
                        INSERT INTO log_inventario (
                            codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken
                        ) 
                        VALUES (
                            $1, $2, 0, '0', 0, 0, $3, $4, 5, 'No existe sku', '0', '0'
                        )`,
                            [codigo, data_procesada[i].ean, huella, id_subproceso]
                        );
                        await client.query('COMMIT');
                    } catch (error) {
                        await client.query('ROLLBACK');
                        console.error(error);
                    } finally {
                        client.release();
                    }
                } catch (error) {
                    console.error(error);
                }

            }

        } else {

            lista_data[i] = {
                ean: `${data[i]}`,
                sku_vtex: `${respuesta_sku.Id}`,
            }
            si[cont_si] = lista_data[i];
            cont_si++;
            registros_inventario = data_procesada[i].registros;

            for (let t = 0; t < registros_inventario.length; t++) {

                tzoffset = (new Date()).getTimezoneOffset() * 60000;
                localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                huella = ((localISOTime.split('T'))[0]).split('-');

                body = {
                    "Id": registros_inventario[t].sku_vtex,
                    "unlimitedQuantity": false,
                    "quantity": registros_inventario[t].stock,
                    "dateUtcOnBalanceSystem": `${huella[0]},${huella[1]},${huella[2]}`
                }
                const options = {
                    method: 'PUT',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-VTEX-API-AppKey': `${registros_inventario[t].apikey}`,
                        'X-VTEX-API-AppToken': `${registros_inventario[t].apitoken}`
                    },
                    body: JSON.stringify(body),
                    redirect: 'follow'
                };

                const urlordenes = `https://${registros_inventario[t].store}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${registros_inventario[t].sku_vtex}/warehouses/${registros_inventario[t].idvtex}`;

                try {
                    data = await fetch(urlordenes, options)
                    respuesta = await data.json();
                } catch (error) {
                    console.log(error);
                }

                if (respuesta == true) {
                    tzoffset = (new Date()).getTimezoneOffset() * 60000;
                    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                    try {
                        const client = await pool_goe.connect();
                        try {
                            await client.query('BEGIN');
                            respuest = await client.query(`
                            INSERT INTO log_inventario ( ean, sku_vtex, fecha_registro )
                            VALUES ( $1, $2, $3, $4' )`,
                                [codigo, registros_inventario[t].ean, registros_inventario[t].sku_vtex, huella]
                            );
                            await client.query('COMMIT');
                        } catch (error) {
                            await client.query('ROLLBACK');
                            console.error(error);
                        } finally {
                            client.release();
                        }
                    } catch (error) {
                        console.error(error);
                    }

                    try {
                        const client = await pool_goe.connect();
                        try {
                            await client.query('BEGIN');
                            respuest = await client.query(`
                                INSERT INTO log_inventario (
                                    codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken
                                ) 
                                VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11
                                )`,
                                [codigo, registros_inventario[t].ean, registros_inventario[t].sku_vtex, registros_inventario[t].store, registros_inventario[t].sucursal, registros_inventario[t].stock, huella, id_subproceso, 1, JSON.stringify(respuesta), registros_inventario[t].apikey, registros_inventario[t].apitoken]
                            );
                            await client.query('COMMIT');
                        } catch (error) {
                            await client.query('ROLLBACK');
                            console.error(error);
                        } finally {
                            client.release();
                        }
                    } catch (error) {
                        console.error(error);
                    }
                } else {
                    tzoffset = (new Date()).getTimezoneOffset() * 60000;
                    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                    try {
                        const client = await pool_goe.connect();
                        try {
                            await client.query('BEGIN');
                            respuest = await client.query(`
                                INSERT INTO log_inventario (
                                    codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken
                                ) 
                                VALUES (
                                    $1, $2, $3, $4, $5, $6, $7, $8, 6, $9, $10, $11
                                )`,
                                [codigo, registros_inventario[t].ean, registros_inventario[t].sku_vtex, registros_inventario[t].store, registros_inventario[t].sucursal, registros_inventario[t].stock, huella, id_subproceso, 1, JSON.stringify(respuesta), registros_inventario[t].apikey, registros_inventario[t].apitoken]
                            );
                            await client.query('COMMIT');
                        } catch (error) {
                            await client.query('ROLLBACK');
                            console.error(error);
                        } finally {
                            client.release();
                        }
                    } catch (error) {
                        console.error(error);
                    }

                }

            }

        }
        
    }

}

ejecutar();