const { workerData } = require('worker_threads');
const fetch = require('node-fetch');
const pool_goe = require('../../../config/db/conn_goe');


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
    contar = 0;

    console.log(data);


    //fs.writeFile(__dirname + '../../../../logs/' + process.env.LOGFILE + '.txt', JSON.stringify(data), { flag: 'a+' }, (err) => { err ? console.log(err) : "" })// Se registra el log en el archivo log_getstock.txt


    for (let i = 0; i < data.length; i++) {

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
            get_sku = await fetch(`https://${keys.cuenta}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/stockkeepingunitbyean/${data[i].ean}`, options1);
            respuesta_sku = await get_sku.json();
            // console.log(respuesta_sku);
        } catch (error) {
            console.log(error);
        }

        if (respuesta_sku.Id == undefined) {

            for (let t = 0; t < (data[i].registros).length; t++) {
                //console.log(contar++);
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
                            [codigo, data[i].ean, huella, id_subproceso]
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

            tzoffset = (new Date()).getTimezoneOffset() * 60000;
            localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
            huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
            for (let t = 0; t < (data[i].registros).length; t++) {


                if ((data[i].registros)[t].store == '') {
                    // console.log('tienda vacia');
                    // console.log((data[i].registros)[t]);
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
                                [codigo, (data[i].registros)[t].ean, (data[i].registros)[t].sku_vtex, (data[i].registros)[t].store, (data[i].registros)[t].sucursal, (data[i].registros)[t].stock, huella, id_subproceso, JSON.stringify(respuesta), (data[i].registros)[t].apikey, (data[i].registros)[t].apitoken]
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

                    // console.log('la tienda esta llena');
                    // console.log((data[i].registros)[t]);

                    body = {
                        "Id": respuesta_sku.Id,
                        "unlimitedQuantity": false,
                        "quantity": (data[i].registros)[t].stock,
                        "dateUtcOnBalanceSystem": `${huella[0]},${huella[1]},${huella[2]}`
                    }
                    const options = {
                        method: 'PUT',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-VTEX-API-AppKey': `${(data[i].registros)[t].apikey}`,
                            'X-VTEX-API-AppToken': `${(data[i].registros)[t].apitoken}`
                        },
                        body: JSON.stringify(body),
                        redirect: 'follow'
                    };
                    const urlordenes = `https://${(data[i].registros)[t].store}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${respuesta_sku.Id}/warehouses/${(data[i].registros)[t].idvtex}`;

                    try {
                        data_reg_stok = await fetch(urlordenes, options)
                        respuesta = await data_reg_stok.json();
                    } catch (error) {
                        console.log(error);
                    }

                    
                    tzoffset = (new Date()).getTimezoneOffset() * 60000;
                    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                    try {
                        const client = await pool_goe.connect();
                        try {
                            await client.query('BEGIN');
                            respuest = await client.query(`
                                INSERT INTO maestra_productos (ean, sku_vtex, fecha_registro)
                                SELECT $1, $2, $3
                                WHERE NOT EXISTS (
                                    SELECT 1 FROM maestra_productos WHERE sku_vtex = $2
                                )`,
                                [(data[i].registros)[t].ean, respuesta_sku.Id, huella]
                            );
                            await client.query('COMMIT');
                            console.log('este SKU no esta en la maestra: ' + respuesta_sku.Id)
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
                                [codigo, (data[i].registros)[t].ean, respuesta_sku.Id, (data[i].registros)[t].store, (data[i].registros)[t].sucursal, (data[i].registros)[t].stock, huella, id_subproceso, JSON.stringify(respuesta), (data[i].registros)[t].apikey, (data[i].registros)[t].apitoken]
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