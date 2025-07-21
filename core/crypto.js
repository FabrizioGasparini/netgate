const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

function encrypt(msg, toPublicKey, fromSecretKey) {
  const nonce = nacl.randomBytes(24);
  const enc = nacl.box(msg, nonce, toPublicKey, fromSecretKey);
  return {
    nonce: Buffer.from(nonce).toString('base64'),
    data: Buffer.from(enc).toString('base64')
  };
}

function decrypt(enc, nonce, fromPublicKey, toSecretKey) {
  return nacl.box.open(
    Buffer.from(enc, 'base64'),
    Buffer.from(nonce, 'base64'),
    fromPublicKey,
    toSecretKey
  );
}

module.exports = { encrypt, decrypt };
