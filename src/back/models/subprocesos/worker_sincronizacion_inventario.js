const { workerData } = require('worker_threads');
const fetch = require('node-fetch');
const pool_goe = require('../../../config/db/conn_goe');

ejecutar = async () => {

    codigo = workerData.codigo;
    data_inventario = workerData.datos_inventario;
    id_subproceso = workerData.subproceso;
    respuest = '';
    respuesta = '';

    console.log('se ejecuto el subproceso ' + id_subproceso);

    for (let y = 0; y < data_inventario.length; y++) {
        if (data_inventario[y].store != undefined) {

            body = {
                "Id": data_inventario[y].sku_vtex,
                "unlimitedQuantity": false,
                "quantity": data_inventario[y].stock,
                "dateUtcOnBalanceSystem": `${data_inventario[y].fecha_inventario}`
            }
            const options = {
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VTEX-API-AppKey': `${data_inventario[y].apikey}`,
                    'X-VTEX-API-AppToken': `${data_inventario[y].apitoken}`
                },
                body: JSON.stringify(body),
                redirect: 'follow'
            };

            const urlordenes = `https://${data_inventario[y].store}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${data_inventario[y].sku_vtex}/warehouses/${data_inventario[y].idvtex}`;
            try {
                data = await fetch(urlordenes, options)
                respuesta = await data.json();
            } catch (error) {
                console.log(error)
            }
            if (respuesta == true) {
                tzoffset = (new Date()).getTimezoneOffset() * 60000;
                localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                try {
                    respuest = await pool_goe.query(`
                        insert into log_inventario (codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                        values (${codigo},'${data_inventario[y].ean}',${data_inventario[y].sku_vtex},'${data_inventario[y].store}',${data_inventario[y].sucursal},${data_inventario[y].stock},'${huella}', ${id_subproceso}, 1, '${JSON.stringify(respuesta)}', '${data_inventario[y].apikey}', '${data_inventario[y].apitoken}')
                    `);
                } catch (error) {
                    console.log(error)
                }
            } else {
                tzoffset = (new Date()).getTimezoneOffset() * 60000;
                localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                try {
                    respuest = await pool_goe.query(`
                        insert into log_inventario (codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                        values (${codigo},'${data_inventario[y].ean}',${data_inventario[y].sku_vtex},'${data_inventario[y].store}',${data_inventario[y].sucursal},${data_inventario[y].stock},'${huella}', ${id_subproceso}, 0, '${JSON.stringify(respuesta)}', '${data_inventario[y].apikey}', '${data_inventario[y].apitoken}')
                    `);
                } catch (error) {
                    console.log(error)
                }
            }
        } else {
            tzoffset = (new Date()).getTimezoneOffset() * 60000;
            localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
            huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
            try {
                respuest = await pool_goe.query(`
                insert into log_inventario (codigo_proceso, ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                values (${codigo},'${data_inventario[y].ean}',${data_inventario[y].sku_vtex},'${data_inventario[y].store}',${data_inventario[y].sucursal},${data_inventario[y].stock},'${huella}', ${id_subproceso}, 2, '${JSON.stringify(respuesta)}', '${data_inventario[y].apikey}', '${data_inventario[y].apitoken}')
            `);
            } catch (error) {
                console.log(error)
            }
            
        }

    }

}

ejecutar();

