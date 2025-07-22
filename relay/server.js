const WebSocket = require('ws');

function startRelayServer(port = 8080) {
  const wss = new WebSocket.Server({ port });
  const clients = new Map();

  console.log(`[📡] Relay server in ascolto su porta ${port}`);

  wss.on('connection', ws => {
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw);

        if (data.type === 'register') {
          ws.name = data.name;
          clients.set(ws.name, ws);
          console.log(`[+] Registrato: ${data.name}`);
        }

        else if (data.type === 'connect') {
          const target = clients.get(data.target);
          if (target) {
            ws.partner = target;
            target.partner = ws;
            target.send(JSON.stringify({ type: 'incoming', from: data.from }));
            console.log(`[→] Connessione richiesta da ${data.from} a ${data.target}`);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'target not found' }));
            console.log(`[✘] Target '${data.target}' non trovato`);
          }
        }

        // 🔁 Inoltro dei messaggi solo se c'è un partner
        else if (ws.partner) {
          ws.partner.send(raw);
        }

      } catch (e) {
        console.error('[relay] Errore parsing messaggio:', e.message);
      }
    });

    ws.on('close', () => {
      if (ws.name) {
        clients.delete(ws.name);
        console.log(`[-] Disconnesso: ${ws.name}`);
      }
    });
  });
}

module.exports = { startRelayServer };
