const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { log } = require('../utils/log');
const nacl = require('tweetnacl');

async function connect(target, bindPort = null, relayUrl = 'ws://netgate.gh3sp.com:8080') {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket(relayUrl);
  let partnerPublicKey = null;

  // Mappa socketId => socket TCP locale
  const tcpSockets = new Map();

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
        case 'publicKey':
          partnerPublicKey = new Uint8Array(Buffer.from(data.key, 'base64'));
          log('Chiave pubblica ricevuta');

          ws.send(JSON.stringify({
            type: 'publicKey',
            key: Buffer.from(myKeys.publicKey).toString('base64')
          }));
          log('Chiave pubblica inviata');

          // Se bindPort è specificato, apro un server TCP locale che inoltra i dati
          if (bindPort && tcpSockets.size === 0) {
            const server = net.createServer(clientSocket => {
              const socketId = Date.now().toString() + Math.random().toString(36).slice(2);
              tcpSockets.set(socketId, clientSocket);
              log(`[connect] Connessione TCP locale in entrata #${socketId} su porta ${bindPort}`);

              ws.send(JSON.stringify({ type: 'newConnection', socketId }));

              clientSocket.on('data', chunk => {
                if (!partnerPublicKey) return;

                const nonce = nacl.randomBytes(nacl.box.nonceLength);
                const encrypted = nacl.box(chunk, nonce, partnerPublicKey, myKeys.secretKey);

                ws.send(JSON.stringify({
                  type: 'secureData',
                  socketId,
                  data: Buffer.from(encrypted).toString('base64'),
                  nonce: Buffer.from(nonce).toString('base64')
                }));
              });

              clientSocket.on('close', () => {
                log(`[connect] Connessione TCP chiusa #${socketId}`);
                tcpSockets.delete(socketId);
              });

              clientSocket.on('error', err => {
                log(`[connect] Errore socket locale #${socketId}: ${err.message}`);
                tcpSockets.delete(socketId);
              });
            });

            server.listen(bindPort, () => {
              log(`In ascolto sulla porta locale ${bindPort}`);
            });
          }
          break;

  

        case 'secureData': {
          const { socketId, data: encryptedData, nonce: nonceB64 } = data;
          if (!socketId || !tcpSockets.has(socketId)) {
            log(`[connect] Socket TCP #${socketId} non trovato o non valido`);
            return;
          }

          const socket = tcpSockets.get(socketId);
          const encrypted = Buffer.from(encryptedData, 'base64');
          const nonce = Buffer.from(nonceB64, 'base64');
          const decrypted = nacl.box.open(encrypted, nonce, partnerPublicKey, myKeys.secretKey);
          
          if (decrypted) {
            socket.write(Buffer.from(decrypted));
          } else {
            log(`[connect] Decryption fallita per socketId #${socketId}`);
          }
          break;
        }

        case 'error':
          console.error('[connect] Errore dal server:', data.message);
          break;

        default:
          log('Messaggio sconosciuto:', data);
      }
    } catch (e) {
      console.error('[connect] Errore parsing messaggio:', e.message);
    }
  });

  // Se non è specificata una porta di bind, fallback a stdin
  if (!bindPort) {
    process.stdin.on('data', chunk => {
      if (!partnerPublicKey) return;

      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const encrypted = nacl.box(chunk, nonce, partnerPublicKey, myKeys.secretKey);

      ws.send(JSON.stringify({
        type: 'secureData',
        socketId: 'terminal', // socketId fittizio per input da terminale
        data: Buffer.from(encrypted).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64')
      }));
    });
  }
}

module.exports = { connect };
