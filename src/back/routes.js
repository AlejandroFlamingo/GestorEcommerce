const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const oracle = require('oracledb');
oracle.initOracleClient({ libDir: `${process.env.LIB_ORACLE}` });

const poolge = require(`../config/db/conn_goe`);


const rutes = express();
rutes.set('views', `${__dirname}/../front/views`);
rutes.set('view engine', 'ejs');

// Importacion de Controladores
const controller_getstock = require(`./controllers/controller_getstock`);
const controller_inventario = require(`./controllers/controller_inventario`);



////////////// CONFIG INICIO SESION///////////////
rutes.use(cookieParser(`${process.env.SECRET}`));
rutes.use(session({
    secret: `${process.env.SECRET}`,
    resave: true,
    saveUninitialized: true,
    // cookie: {
    //     secure: true,
    //     httpOnly: true
    // }
}));
rutes.use(passport.initialize());
rutes.use(passport.session());
passport.use(new LocalStrategy(async function (username, password, done) {
    const usr = username
    const pwd = password

    const respuest = await poolge.query(`SELECT username, canal, rol, nombre, email, tienda, estado FROM identity WHERE username='${usr}'`);
    if (respuest.rowCount > 0){
        ws_url = `${process.env.URL_LDAP}`;
        ws_opciones = {
            method: "POST",
            headers: {
                "Content-Type":"application/json",
                "service_flamingo_token":`${process.env.TOKEN_LDAP}`,
                "usuario": usr,
                "pass": pwd,
                "grupo": process.env.GRUPO_LDAP,
                "ou": "Aplicaciones"
            }
        }
    
        const ws_ldap = await fetch(ws_url, ws_opciones);
        const respu = await ws_ldap.json();
        // Respuesra LDAP
        // console.log(respu);
        
        if (respu.codigo === 200) {
            datauser = {
                username: respuest.rows[0].username,
                canal: respuest.rows[0].canal,
                rol: respuest.rows[0].rol,
                nombre: respuest.rows[0].nombre,
                email: respuest.rows[0].email,
                tienda: respuest.rows[0].tienda,
                estado: respuest.rows[0].estado
            }
            return done(null, datauser);
        }
    }
    done(null, false);
}));
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (id, done) {
    done(null, datauser);
});
//////////////////////////////////////////////////

//////////////////////LOGIN///////////////////////
rutes.post('/login', passport.authenticate('local', {
    successRedirect: '/inicial',
    failureRedirect: '/login'
}));
rutes.get('/', (req, res) => {
    res.render('login');
});
rutes.get('/login', (req, res) => {
    res.render('login');
});
//////////////////////////////////////////////////

//////////////////PAGINA INICIAL//////////////////
rutes.get('/inicial', (req, res, next) => {
    const permisos = [
        'ADMINISTRADORTECNO'
    ];
    if (req.isAuthenticated()) {
        if (permisos.includes(req.session.passport.user.rol)) {
            return next();
        }else{
            res.redirect('/denegado');
        }
    }else{
        res.redirect('/login');
    }
}, (req, res) => {
    res.render('inicial', { dataUser: req.session.passport.user });
});
//////////////////////////////////////////////////

//////////////////ACCESO DENEGADO/////////////////
rutes.get('/denegado', (req, res, next) => {
    const permisos = [
        'ADMINISTRADORTECNO'
    ];
    if (req.isAuthenticated()) {
        if (permisos.includes(req.session.passport.user.rol)) {
            return next();
        }else{
            res.redirect('/denegado');
        }
    }else{
        res.redirect('/login');
    }
}, (req, res) => {
    res.render('denegado');
});
//////////////////////////////////////////////////










rutes.get('/inventario', (req, res, next) => {
    const permisos = [
        'ADMINISTRADORTECNO'
    ];
    if (req.isAuthenticated()) {
        if (permisos.includes(req.session.passport.user.rol)) {
            return next();
        }else{
            res.redirect('/denegado');
        }
    }else{
        res.redirect('/login');
    }
}, controller_inventario.data_inicial_inventario);


rutes.post('/inicio_inventario', (req, res, next) => {
    const permisos = [
        'ADMINISTRADORTECNO'
    ];
    if (req.isAuthenticated()) {
        if (permisos.includes(req.session.passport.user.rol)) {
            return next();
        }else{
            res.redirect('/denegado');
        }
    }else{
        res.redirect('/login');
    }
}, controller_getstock.get_stock);
























rutes.get("/salir", function (req, res) { 
    req.logout(req.user, err => {
      if(err) return next(err);
      res.redirect("/");
    });
  });



//Rutas
rutes.post('/inventario', controller_getstock.get_stock);

module.exports = rutes;