const net = require('net');
const { setupWebSocket } = require('./websocket');
const { loadOrGenerateKeys } = require('./keys');
const { log } = require('../utils/log');
const nacl = require('tweetnacl');

async function expose(port, name, relayUrl = 'ws://netgate.gh3sp.com:8080') {
  const myKeys = loadOrGenerateKeys();
  const ws = setupWebSocket(relayUrl);
  let partnerPublicKey = null;

  // Mappa socketId => socket TCP locale
  const tcpSockets = new Map();

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'register', name }));
    log(`Registrato come '${name}'`);
  });

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case 'incoming':
          // Invio la mia chiave pubblica quando qualcuno tenta di connettersi
          ws.send(JSON.stringify({
            type: 'publicKey',
            key: Buffer.from(myKeys.publicKey).toString('base64')
          }));
          log('Chiave pubblica inviata');
          break;

        case 'publicKey':
          partnerPublicKey = new Uint8Array(Buffer.from(data.key, 'base64'));
          log('Chiave pubblica ricevuta');
          break;

        case 'secureData': {
          const { socketId, data: encryptedData, nonce: nonceB64 } = data;
          if (!socketId || !tcpSockets.has(socketId)) {
            log(`[expose] Socket TCP #${socketId} non trovato o non valido`);
            return;
          }
          const socket = tcpSockets.get(socketId);
          const encrypted = Buffer.from(encryptedData, 'base64');
          const nonce = Buffer.from(nonceB64, 'base64');
          const decrypted = nacl.box.open(encrypted, nonce, partnerPublicKey, myKeys.secretKey);

          if (decrypted) {
            socket.write(Buffer.from(decrypted));
          } else {
            log(`[expose] Decryption fallita per socketId #${socketId}`);
          }
          break;
        }
          
        case 'newConnection': {
          const { socketId } = data;
          log(`[expose] Ricevuta nuova connessione da connect, ID: ${socketId}`);

          // 1️⃣ Crea un nuovo socket TCP verso la porta locale esposta
          const clientSocket = net.connect({ port }, () => {
            log(`[expose] Connessione TCP aperta verso porta ${port} per socketId ${socketId}`);
          });

          // 2️⃣ Salva il socket associato al socketId
          tcpSockets.set(socketId, clientSocket);

          // 3️⃣ Quando ricevi dati dal server reale (es. SSH), inviali criptati a connect
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
            log(`[expose] Socket TCP chiuso per socketId ${socketId}`);
            tcpSockets.delete(socketId);
          });

          clientSocket.on('error', err => {
            console.error(`[expose] Errore TCP per socketId ${socketId}:`, err.message);
            tcpSockets.delete(socketId);
          });
        }
    

        case 'error':
          console.error('[expose] Errore dal server:', data.message);
          break;

        default:
          log('Messaggio sconosciuto:', data);
      }
    } catch (e) {
      console.error('[expose] Errore parsing messaggio:', e.message);
    }
  });

  const server = net.createServer(clientSocket => {
    const socketId = Date.now().toString() + Math.random().toString(36).slice(2);
    tcpSockets.set(socketId, clientSocket);
    log(`[expose] Connessione TCP #${socketId} accettata`);

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
      log(`Connessione locale chiusa #${socketId}`);
      tcpSockets.delete(socketId);
    });

    clientSocket.on('error', err => {
      log(`Errore socket locale #${socketId}: ${err.message}`);
      tcpSockets.delete(socketId);
    });
  });

  server.listen(port, () => {
    log(`Porta ${port} esposta come '${name}'`);
  });

  server.on('error', err => console.error('[expose] Errore server:', err));
}

module.exports = { expose };
