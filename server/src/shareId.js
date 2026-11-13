const { randomBytes } = require('crypto');

const SHARE_ID_BYTES = 16; // 16 bytes = 32 hex characters, 128 random bits

/* T-79: a share ID made of 0-9 and a-f. randomBytes reads the operating system's secure 
random source, so IDs can't be guessed the way Math.random() values can.*/
function generateShareId() {
  return randomBytes(SHARE_ID_BYTES).toString('hex');
}

module.exports = { generateShareId };