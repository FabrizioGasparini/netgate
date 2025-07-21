const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { encrypt, decrypt } = require('./crypto');
const { log } = require('../utils/log');

async function expose(port, name, relay) {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket(relay || "ws://netgate.gh3sp.com:8080");
  let partnerPublicKey = null;
  let remoteSocket = null; // socket per comunicazione lato locale (ssh)

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
          if (remoteSocket) {
            const raw = decrypt(data.data, data.nonce, partnerPublicKey, myKeys.secretKey);
            if (raw) {
              remoteSocket.write(Buffer.from(raw));
            }
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

  // Quando arriva una connessione TCP locale (da client connect)
  const server = net.createServer(socket => {
    log(`Connessione locale su porta ${port} stabilita`);

    // Qui apro la connessione TCP al vero server ssh locale sulla porta 22
    remoteSocket = net.createConnection(22, '127.0.0.1', () => {
      log('Connesso al server SSH locale (127.0.0.1:22)');
    });

    // Quando ricevo dati dal client TCP locale, li cifro e li invio via WS
    socket.on('data', chunk => {
      if (!partnerPublicKey) return;
      const enc = encrypt(chunk, partnerPublicKey, myKeys.secretKey);
      ws.send(JSON.stringify({ type: 'secureData', data: enc.data, nonce: enc.nonce }));
    });

    // Quando ricevo dati dal server ssh locale li inoltro al socket TCP locale
    remoteSocket.on('data', chunk => {
      if (!partnerPublicKey) return;
      const enc = encrypt(chunk, partnerPublicKey, myKeys.secretKey);
      ws.send(JSON.stringify({ type: 'secureData', data: enc.data, nonce: enc.nonce }));
    });

    // Quando ricevo dati dal WS li scrivo sul socket ssh locale
    // Questo è già gestito nel 'ws.on("message")' sopra (secureData case)

    socket.on('close', () => {
      log('Connessione locale chiusa');
      remoteSocket.end();
      remoteSocket = null;
    });

    socket.on('error', err => {
      console.error('[gh3netgate] Errore socket locale:', err.message);
    });

    remoteSocket.on('error', err => {
      console.error('[gh3netgate] Errore socket SSH locale:', err.message);
    });
  });

  server.listen(port, () => log(`Porta ${port} esposta come '${name}'`));
}

module.exports = { expose };
