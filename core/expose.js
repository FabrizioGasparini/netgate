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
    ws.send(JSON.stringify({ type: 'register', name, tunnelInfo: { type: 'expose', pid: process.pid, connections: [] } }));
    log(`✅ Registrato come '${name}'`);
  });

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      switch (data.type) {
        case 'incoming':
          // Qualcuno vuole connettersi → invia chiave pubblica
          ws.send(JSON.stringify({
            type: 'publicKey',
            key: Buffer.from(myKeys.publicKey).toString('base64')
          }));
          log('📤 Chiave pubblica inviata');
          break;

        case 'publicKey':
          partnerPublicKey = new Uint8Array(Buffer.from(data.key, 'base64'));
          log('📥 Chiave pubblica ricevuta');
          break;

        case 'newConnection': {
          const { socketId } = data;
          log(`🔌 Nuova connessione richiesta dal client, ID: ${socketId}`);

          const socket = net.connect({ port: port, host: '127.0.0.1' }, () => {
            log(`➡️ Socket TCP locale connesso alla porta ${port} per ID ${socketId}`);
          });

          tcpSockets.set(socketId, socket);

          socket.on('data', chunk => {
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

          socket.on('close', () => {
            log(`❌ Socket TCP chiuso per ID ${socketId}`);
            tcpSockets.delete(socketId);
          });

          socket.on('error', err => {
            log(`⚠️ Errore TCP (${socketId}): ${err.message}`);
            tcpSockets.delete(socketId);
          });

          break;
        }

        case 'secureData': {
          const { socketId, data: encData, nonce: nonceB64 } = data;
          if (!tcpSockets.has(socketId)) {
            log(`⚠️ Socket ID ${socketId} non trovato`);
            return;
          }

          const socket = tcpSockets.get(socketId);
          const encrypted = Buffer.from(encData, 'base64');
          const nonce = Buffer.from(nonceB64, 'base64');
          const decrypted = nacl.box.open(encrypted, nonce, partnerPublicKey, myKeys.secretKey);

          if (decrypted) {
            socket.write(Buffer.from(decrypted));
          } else {
            log(`❌ Decryption fallita per socket ${socketId}`);
          }
          break;
        }

        case 'error':
          console.error('[expose] Errore dal server relay:', data.message);
          ws.send(JSON.stringify({ type: 'stopTunnel', name }));
          break;

        case 'connect':
          log('⚠️ Utente connesso:', data);
          break;
        default:
          log('⚠️ Messaggio sconosciuto:', data);
          break;
      }
    } catch (e) {
      console.error('[expose] Errore parsing messaggio:', e.message);
    }
  });

  ws.on('close', () => {
    ws.send(JSON.stringify({ type: 'stopTunnel', name }));
  })
  ws.on('error', () => {
    ws.send(JSON.stringify({ type: 'stopTunnel', name }));
  })
  
  function onShutdown() {
    ws.send(JSON.stringify({ type: 'stopTunnel', name }));
    process.exit(0)
  }

  process.on('SIGINT', onShutdown);   // CTRL+C
  process.on('SIGTERM', onShutdown);  // kill PID
  process.on('exit', onShutdown);     // qualsiasi uscita
}


if (require.main === module) {  // Se eseguito direttamente da node
  const [, , command, ...args] = process.argv;

  if (command === 'expose') {
    // Assumiamo args: port, name, relayUrl (opzionale)
    const port = parseInt(args[0]);
    const name = args[1];
    const relayUrl = args[2] || 'ws://netgate.gh3sp.com:8080';

    expose(port, name, relayUrl).catch(err => {
      console.error('Errore in expose:', err);
      process.exit(1);
    });
  } else {
    console.error('Comando non riconosciuto o mancante');
    process.exit(1);
  }
}

module.exports = { expose };

