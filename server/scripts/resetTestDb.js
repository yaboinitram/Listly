const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function resetTestDb() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const schema = fs
    .readFileSync(schemaPath, 'utf8')
    .replace(/^\s*CREATE DATABASE.*;\s*$/im, '')
    .replace(/^\s*USE .*;\s*$/im, '');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'listly_test',
    multipleStatements: true,
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await conn.query('SHOW TABLES');
    for (const row of tables) {
      await conn.query(`DROP TABLE IF EXISTS \`${Object.values(row)[0]}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.query(schema);
  } finally {
    await conn.end();
  }
}

module.exports = resetTestDb;

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  resetTestDb()
    .then(() => console.log('listly_test reset.'))
    .catch((err) => { console.error(err.message); process.exit(1); });
}