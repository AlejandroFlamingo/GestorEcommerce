const dovtenv = require('dotenv');
const path = require('path');

dovtenv.config({path: path.resolve(__dirname, process.env.NODE_ENV+'.env')});

envi = {
    NODE_ENV: process.env.NODE_ENV || 'production', 
    PORT: process.env.PORT || '8020',

}
module.exports.envi = envi