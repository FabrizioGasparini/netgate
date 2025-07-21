const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { encrypt, decrypt } = require('./crypto');
const { log } = require('../utils/log');

async function connect(target, localPort = 2222) {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket('ws://netgate.gh3sp.com:8080');
  let partnerPublicKey = null;
  let tcpSocket = null;  // socket TCP locale (ssh client)

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'connect',
      target,
      from: 'client-' + Date.now()
    }));
    log(`Richiesta connessione a '${target}' inviata`);
  });

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case 'incoming':
          ws.send(JSON.stringify({
            type: 'publicKey',
            key: Buffer.from(myKeys.publicKey).toString('base64')
          }));
          log('Inviata chiave pubblica');
          break;
        case 'publicKey':
          partnerPublicKey = new Uint8Array(Buffer.from(data.key, 'base64'));
          log('Chiave pubblica ricevuta');
          break;
        case 'secureData':
          if (!tcpSocket) {
            log('Nessun socket TCP locale connesso, ignorando dati');
            return;
          }
          const raw = decrypt(data.data, data.nonce, partnerPublicKey, myKeys.secretKey);
          if (raw) tcpSocket.write(Buffer.from(raw));
          break;
        case 'error':
          console.error('[gh3netgate] Errore dal server:', data.message);
          break;
        default:
          log('Messaggio sconosciuto:', data);
      }
    } catch (e) {
      console.error('[gh3netgate] Errore parsing messaggio:', e.message);
    }
  });

  // Creo un server TCP locale su localPort (es. 2222)
  const server = net.createServer(socket => {
    log(`Connessione TCP locale accettata su porta ${localPort}`);
    tcpSocket = socket;

    socket.on('data', chunk => {
      if (!partnerPublicKey) return;
      const enc = encrypt(chunk, partnerPublicKey, myKeys.secretKey);
      ws.send(JSON.stringify({ type: 'secureData', data: enc.data, nonce: enc.nonce, target }));
    });

    socket.on('close', () => {
      log('Connessione TCP locale chiusa');
      tcpSocket = null;
    });

    socket.on('error', err => {
      console.error('[gh3netgate] Errore socket TCP:', err.message);
    });
  });

  server.listen(localPort, () => {
    log(`Server TCP locale in ascolto su porta ${localPort}`);
    log(`Ora puoi fare: ssh localhost -p ${localPort}`);
  });
}

module.exports = { connect };
