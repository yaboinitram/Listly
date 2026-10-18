require('dotenv').config({quiet: true});

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missing = require.filter((name) => !process.env[name]);
if (missing.length > 0){
    console.error('JWT_SECRET must be at least 32 charaters. See .env.example for more.');
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32){
    console.error('JWT_SECRET must be at least 32 charaters. See .env.example for more.');
    process.exit(1);
}

const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listly API listening on port ${port}`));