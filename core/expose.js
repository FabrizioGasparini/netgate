const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { encrypt, decrypt } = require('./crypto');
const { log } = require('../utils/log');

async function expose(port, name) {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket('ws://localhost:8080');
  let partnerPublicKey = null;
  let socket;

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'register', name }));
    log(`Registrato come '${name}'`);
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case 'incoming':
          ws.send(JSON.stringify({
            type: 'publicKey',
            key: Buffer.from(myKeys.publicKey).toString('base64')
          }));
          break;
        case 'publicKey':
          partnerPublicKey = new Uint8Array(Buffer.from(data.key, 'base64'));
          break;
        case 'secureData':
          if (socket) {
            const raw = decrypt(data.data, data.nonce, partnerPublicKey, myKeys.secretKey);
            if (raw) socket.write(Buffer.from(raw));
          }
          break;
        case 'error':
          console.error('[gh3netgate] Errore:', data.message);
          break;
        default:
          log('Messaggio sconosciuto:', data);
      }
    } catch (e) {
      console.error('[gh3netgate] Errore parsing:', e.message);
    }
  });

  const server = net.createServer(s => {
    socket = s;
    log(`Connessione locale su porta ${port} stabilita`);
    s.on('data', chunk => {
      if (!partnerPublicKey) return;
      const enc = encrypt(chunk, partnerPublicKey, myKeys.secretKey);
      ws.send(JSON.stringify({ type: 'secureData', data: enc.data, nonce: enc.nonce }));
    });

    s.on('close', () => log('Connessione locale chiusa'));
  });

  server.listen(port, () => log(`Porta ${port} esposta come '${name}'`));
}

module.exports = { expose };
