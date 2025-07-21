const WebSocket = require('ws');

function startRelayServer(port = 8080) {
  const wss = new WebSocket.Server({ port });
  const clients = new Map();

  console.log(`[📡] Relay server in ascolto su porta ${port}`);

  wss.on('connection', ws => {
    ws.on('message', msg => {
      try {
        const data = JSON.parse(msg);

        if (data.type === 'register') {
          ws.name = data.name;
          clients.set(data.name, ws);
          console.log(`[+] Registrato: ${data.name}`);
        }

        if (data.type === 'connect') {
          const target = clients.get(data.target);
          if (target) {
            ws.partner = target;
            target.partner = ws;
            target.send(JSON.stringify({ type: 'incoming', from: data.from }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'target not found' }));
          }
        }

        if (ws.partner) {
          ws.partner.send(msg); // inoltro diretto del messaggio
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
