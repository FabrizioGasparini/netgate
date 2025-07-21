const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { encrypt, decrypt } = require('./crypto');
const { log } = require('../utils/log');

async function expose(port, name, relay) {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket(relay || "ws://netgate.gh3sp.com:8080");
  let partnerPublicKey = null;
  let remoteSocket = null;
  let clientSocket = null; // socket tcp lato client ws

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'register', name }));
    log(`Registrato come '${name}'`);
  });

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case 'connect':
          log(`Richiesta connessione da ${data.from}`);

          // Apro connessione TCP al server SSH locale solo quando ricevo connect
          if (remoteSocket) {
            remoteSocket.destroy();
            remoteSocket = null;
          }

          remoteSocket = net.createConnection(port, '127.0.0.1', () => {
            log(`Connesso al server SSH locale su 127.0.0.1:${port}`);
          });

          remoteSocket.on('data', chunk => {
            if (!partnerPublicKey) return;
            const enc = encrypt(chunk, partnerPublicKey, myKeys.secretKey);
            ws.send(JSON.stringify({ type: 'secureData', data: enc.data, nonce: enc.nonce }));
          });

          remoteSocket.on('error', err => {
            console.error('[gh3netgate] Errore socket SSH locale:', err.message);
          });

          remoteSocket.on('close', () => {
            log('Connessione al server SSH locale chiusa');
          });

          ws.send(JSON.stringify({
            type: 'incoming',
            target: data.from
          }));

          // Reset chiave partner per questa nuova connessione
          partnerPublicKey = null;
          clientSocket = null;
          break;

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
          if (!partnerPublicKey || !remoteSocket) {
            console.warn('[gh3netgate] 🔒 partnerPublicKey o remoteSocket non pronti!');
            return;
          }
          const raw = decrypt(data.data, data.nonce, partnerPublicKey, myKeys.secretKey);
          if (raw) {
            remoteSocket.write(Buffer.from(raw));
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

  // Server TCP locale che accetta connessioni dal client SSH (solo per logging o gestione interna)
  const server = net.createServer(socket => {
    log(`Connessione TCP locale accettata su porta ${port}`);
    clientSocket = socket;

    socket.on('data', chunk => {
      // Puoi loggare o gestire i dati del client tcp locale se serve
      log(`Ricevuti ${chunk.length} bytes dal client TCP locale`);
    });

    socket.on('close', () => {
      log('Connessione TCP locale chiusa');
    });

    socket.on('error', err => {
      console.error('[gh3netgate] Errore socket TCP locale:', err.message);
    });
  });

  server.listen(port, () => log(`Porta ${port} esposta come '${name}'`));
}

module.exports = { expose };
