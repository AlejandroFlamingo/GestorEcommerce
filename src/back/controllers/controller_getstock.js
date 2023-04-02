const model_getstock = require('../models/model_getstock');
const model_inventario = require('../models/model_inventario');
const logs = require('../../config/logs');
const middleware = require('../../config/middleware');

file_logs = 'log_getstock'
//file_logs = process.env.LOGFILE

let get_stock = async (req, res) => {

    tzoffset = (new Date()).getTimezoneOffset() * 60000;
    localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);

    await model_getstock.model_sincronizacion_inventario();
    respuesta = await model_inventario.model_inventario_config((localISOTime.split('T'))[0]+' 00:00:00.001', (localISOTime.split('T'))[0]+' 23:59:59.998');
    res.render('inventario_config', { datos: respuesta, dataUser: req.session.passport.user });

}

module.exports.get_stock = get_stock;