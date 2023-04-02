
const fs = require('fs');
const fetch = require('node-fetch');
const pool_goe = require('../../../config/db/conn_goe');

process.on("message", async (unicos_sku) => {

    hoy = new Date();

    lista_data = [];
    si = [];
    cont_si = 0;
    no = [];
    cont_no = 0;
    data = unicos_sku.eanes
    keys = unicos_sku.keys

    //fs.writeFile(__dirname + '../../../../logs/' + process.env.LOGFILE + '.txt', JSON.stringify(data), { flag: 'a+' }, (err) => { err ? console.log(err) : "" })// Se registra el log en el archivo log_getstock.txt

    seguimiento_proceso = async (msg)=>{
        tzoffset = (new Date()).getTimezoneOffset() * 60000;
        localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
        huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
    
        respuest = await pool_goe.query(`
        insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
        values ('0',0,'0',0,0,'${huella}', 0, 3, '${msg}', 'xxxxxxxxxx', 'xxxxxxxxxx')
        `);
    }
    seguimiento_proceso('Inicio proceso CONSULTA_SKU_VTEX');



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
        get_sku = await fetch(`https://${keys.cuenta}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/stockkeepingunitbyean/${data_procesada[i].ean}`, options1);
        respuesta_sku = await get_sku.json();
        if (respuesta_sku.Id == undefined) {

            // { ean: 7701103723195, sku_vtex: 0, sucursal: 121, stock: 0 }

            for (let t = 0; t < (data_procesada[i].registros).length; t++) {
                tzoffset = (new Date()).getTimezoneOffset() * 60000;
                localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                respuest = await pool_goe.query(`
                    insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                    values ('${data_procesada[i].ean}',0,'99999',${data_procesada[i].sucursal},0,'${huella}', 99, 0, 'EAN no registrado en VTEX', '${keys.key}', '${keys.token}')
                `);
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
                data = await fetch(urlordenes, options)
                respuesta = await data.json();
                //console.log('Subproceso 1');
                if (respuesta == true) {
                    //console.log(respuesta);
                    //console.log("EAN: " + registros_inventario[t].ean);
                    //console.log("SKU: " + registros_inventario[t].sku_vtex);
                    //console.log("Tienda: " + registros_inventario[t].store);
                    tzoffset = (new Date()).getTimezoneOffset() * 60000;
                    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                    respuest = await pool_goe.query(`
                        insert into maestra_productos (ean, sku_vtex, fecha_registro) 
                        values ('${registros_inventario[t].ean}',${registros_inventario[t].sku_vtex}, '${huella}')
                    `);
                    respuest = await pool_goe.query(`
                        insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                        values ('${registros_inventario[t].ean}',${registros_inventario[t].sku_vtex},'${registros_inventario[t].store}',${registros_inventario[t].sucursal},${registros_inventario[t].stock},'${huella}', 1, 4, '${JSON.stringify(respuesta)}', '${registros_inventario[t].apikey}', '${registros_inventario[t].apitoken}')
                    `);
                } else {
                    tzoffset = (new Date()).getTimezoneOffset() * 60000;
                    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
                    huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
                    respuest = await pool_goe.query(`
                        insert into log_inventario (ean, sku, whitelabel, sucursal, inventario, fecha_registro, subproceso, estado, response, apikey, apitoken) 
                        values ('${registros_inventario[t].ean}',${registros_inventario[t].sku_vtex},'${registros_inventario[t].store}',${registros_inventario[t].sucursal},${registros_inventario[t].stock},'${huella}', 1, 0, '${JSON.stringify(respuesta)}', '${registros_inventario[t].apikey}', '${registros_inventario[t].apitoken}')
                    `);
                }

            }

        }
    }

    seguimiento_proceso('Finalizo proceso CONSULTA_SKU_VTEX');

});