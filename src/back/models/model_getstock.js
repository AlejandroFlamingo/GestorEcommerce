const poolgoe = require(`../../config/db/conn_goe`);
const poollocal = require(`../../config/db/conn_gestion`);
const log_proceso = require(`../../config/logs`);

//file_logs = 'log_reporte_inventario'
file_logs = process.env.LOGFILE

let model_sincronizacion_inventario = async () => {
  const { Worker } = require('worker_threads');

  tzoffset = (new Date()).getTimezoneOffset() * 60000;
  localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
  huella = `${(localISOTime.split('T'))[0]} ${(localISOTime.split('T'))[1]}`;
  fecha_hoy = (localISOTime.split('T'))[0];
  hoy = localISOTime.replace('T', ' ');

  codigo = await poolgoe.query(`select max(codigo_proceso) from log_inventario`)
  cod_proceso = codigo.rows;
  codigo_proceso = cod_proceso[0].max == null ? 1 : cod_proceso[0].max + 1

  log_proceso.seguimiento_proceso(codigo_proceso, 'inicio de sincronizacion de inventario para Ecommerce', 3);

  // Crear el subproceso y pasarle el codigo que identifica el proceso
  const process_code  = { codigo: codigo_proceso };
  const worker = new Worker(__dirname + '/subprocesos/worker_principal.js', { workerData: process_code });
  worker.on('message', (data) => {
    console.log(`Mensaje recibido: ${data}`);
  });

  // Enviar mensajes al subproceso
  //worker.postMessage('Hola desde el hilo principal de ejecucion!');

  return "ejecucion exitosa de sincronizaicon de inventario";

}

module.exports.model_sincronizacion_inventario = model_sincronizacion_inventario;