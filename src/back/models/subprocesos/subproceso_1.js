const fetch = require('node-fetch');
const pool_goe = require('../../../config/db/conn_goe');

process.on("message", async (unicos_sku) => {

    
    seguimiento_proceso = async (msg)=>{
        tzoffset = (new Date()).getTimezoneOffset() * 60000;
        localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
        huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
    
        respuest = await pool_goe.query(`
        insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
        values ('0',0,'0',0,0,'${huella}', 0, 3, '${msg}', 'xxxxxxxxxx', 'xxxxxxxxxx')
        `);
    }
    seguimiento_proceso('Inicio subproceso 1');

    datos = unicos_sku.data;

    for (let y = 0; y < datos.length; y++) {

        body = {
            "Id": datos[y].sku_vtex,
            "unlimitedQuantity": false,
            "quantity": datos[y].stock,
            "dateUtcOnBalanceSystem": `${datos[y].fecha_inventario}`
        }
        const options = {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VTEX-API-AppKey': `${datos[y].apikey}`,
                'X-VTEX-API-AppToken': `${datos[y].apitoken}`
            },
            body: JSON.stringify(body),
            redirect: 'follow'
        };

        const urlordenes = `https://${datos[y].store}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${datos[y].sku_vtex}/warehouses/${datos[y].idvtex}`;
        data = await fetch(urlordenes, options)
        respuesta = await data.json();
        if (respuesta == true) {
            tzoffset = (new Date()).getTimezoneOffset() * 60000;
            localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
            huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
            respuest = await pool_goe.query(`
                insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                values ('${datos[y].ean}',${datos[y].sku_vtex},'${datos[y].store}',${datos[y].sucursal},${datos[y].stock},'${huella}', 1, 1, '${JSON.stringify(respuesta)}', '${datos[y].apikey}', '${datos[y].apitoken}')
            `);
        } else {
            tzoffset = (new Date()).getTimezoneOffset() * 60000;
            localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
            huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
            respuest = await pool_goe.query(`
                insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                values ('${datos[y].ean}',${datos[y].sku_vtex},'${datos[y].store}',${datos[y].sucursal},${datos[y].stock},'${huella}', 1, 0, '${JSON.stringify(respuesta)}', '${datos[y].apikey}', '${datos[y].apitoken}')
            `);
        }


    }

    seguimiento_proceso('Finalizo subproceso 1');
});



