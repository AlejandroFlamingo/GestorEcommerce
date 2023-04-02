const model = require('../models/model_inventario');
const logs = require('../../config/logs');
const middleware = require('../../config/middleware');

file_logs = 'log_inventario';

let data_inicial_inventario = async (req, res) => {

    respuesta = await model.model_inventario_config();
    res.render('inventario_config', { datos: respuesta, dataUser: req.session.passport.user });

}

module.exports.data_inicial_inventario = data_inicial_inventario
