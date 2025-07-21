const fs = require('fs');
const nacl = require('tweetnacl');

function loadOrGenerateKeys(dir = './keys') {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const pubPath = `${dir}/id.pub`;
  const secPath = `${dir}/id.secret`;

  if (fs.existsSync(pubPath) && fs.existsSync(secPath)) {
    return {
      publicKey: new Uint8Array(fs.readFileSync(pubPath)),
      secretKey: new Uint8Array(fs.readFileSync(secPath))
    };
  }

  const keyPair = nacl.box.keyPair();
  fs.writeFileSync(pubPath, Buffer.from(keyPair.publicKey));
  fs.writeFileSync(secPath, Buffer.from(keyPair.secretKey));
  console.log('[🔑] Chiavi generate e salvate');
  return keyPair;
}

module.exports = { loadOrGenerateKeys };
