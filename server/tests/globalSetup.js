module.exports = async () => {
  require('dotenv').config({ quiet: true });
  await require('../scripts/resetTestDb')();
};