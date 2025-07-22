const WebSocket = require('ws');

function startRelayServer(port = 8080) {
  const wss = new WebSocket.Server({ port });
  const clients = new Map();
  const tunnels = new Map();

  console.log(`[📡] Relay server in ascolto su porta ${port}`);

  wss.on('connection', ws => {
    ws.on('message', raw => {
      try {
        const data = JSON.parse(raw);

        if (data.type === 'register') {
          ws.name = data.name;
          clients.set(ws.name, ws);
          // Salva info tunnel se fornite
          if (data.tunnelInfo) {
            tunnels.set(ws.name, data.tunnelInfo);
            console.log(`[+] Tunnel registrato: ${ws.name}`, data.tunnelInfo);
          } else {
            console.log(`[+] Client registrato senza tunnel info: ${ws.name}`);
          }
        }

        else if (data.type === 'stopTunnel') {
          if (tunnels.has(data.name)) {
            tunnels.delete(data.name);
            console.log(`[-] Tunnel fermato: ${data.name}`);
            // Manda messaggio al client per fermare il processo se connesso
            const clientWs = clients.get(data.name);
            if (clientWs) clientWs.send(JSON.stringify({ type: 'stopTunnel' }));
          }
          
        }

        else if (data.type === 'stopConnection') {
          // Aggiorna la lista connections nel tunnel
          const tunnel = tunnels.get(data.name);
          if (tunnel && Array.isArray(tunnel.connections)) {
            tunnel.connections = tunnel.connections.filter(pid => pid !== data.pid);
            tunnels.set(data.name, tunnel);
            console.log(`[✂️] Connessione su porta ${data.port} rimossa da tunnel ${data.name}`);
            // Manda messaggio al client per chiudere la connessione se necessario
            const clientWs = clients.get(data.name);
            if (clientWs) clientWs.send(JSON.stringify({ type: 'stopConnection', port: data.port }));
          }
          
        }

        else if (data.type === 'listTunnels') {
          // Rispondi con la lista dei tunnel
          ws.send(JSON.stringify({ type: 'tunnelsList', tunnels: Array.from(tunnels.entries()) }));
        }

        // Gestione connessioni WebSocket come prima (connect, forward messaggi, ecc.)
        else if (data.type === 'connect') {
          const target = clients.get(data.target);
          if (target) {
            ws.partner = target;
            target.partner = ws;
            target.send(JSON.stringify({ type: 'incoming', from: data.from }));
            console.log(`[→] Connessione richiesta da ${data.from} a ${data.target}`);
            const tunnel = tunnels.get(data.target)
            tunnel.connections = [...tunnel.connections, data.pid]
            tunnels.set(data.target, tunnel)
            
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'target not found' }));
            console.log(`[✘] Target '${data.target}' non trovato`);
          }
        }

        // Inoltro messaggi
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
        tunnels.delete(ws.name);  // Rimuovi tunnel associato
        console.log(`[-] Disconnesso: ${ws.name}`);
        
      }
    });
  });
}

module.exports = { startRelayServer };
