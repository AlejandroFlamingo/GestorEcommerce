const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const https = require('https');
const config = require('./config/env/config.js');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
app.use(express.json());
//app.use(require('./config/middleware'));
app.set('port', config.envi.PORT);

app.use('/public', express.static(`${__dirname}/front/public`));
//app.use('/docs', express.static(`${__dirname}/doc_proyectos`));

app.use(require('./back/routes'));

/*
? Con este codigo se levanta el servidor con el protocolo HTTPS usando certificado SSL
! Si se habilita este codigo se debe eliminar o comentar las lineas 29, 30, 31 y 32 de este archivo
https.createServer({
    cert: fs.readFileSync(`${__dirname}/../ssl/cert.crt`),
    key: fs.readFileSync(`${__dirname}/../ssl/cert.key`)
}, app).listen(app.get('port'), ()=>{
    console.log(`Servidor corriendo en el puerto ${app.get('port')}`);
});
*/
/*
app.listen(app.get('port'), ()=>{
    console.log(`NODE_ENV=${config.envi.NODE_ENV}`);
    console.log(`Servidor corriendo en el puerto ${app.get('port')}`);
});
*/

app.listen(app.get('port'), ()=>{
    console.log(`NODE_ENV=${config.envi.NODE_ENV}`);
    console.log(`Servidor corriendo en el puerto ${app.get('port')}`);
});