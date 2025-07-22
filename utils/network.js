const WebSocket = require('ws');

async function isRelayAvailable(relayUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);

    const timeout = setTimeout(() => {
      ws.terminate();
      resolve(false);
    }, 3000); // 3 secondi

    ws.on('open', () => {
      clearTimeout(timeout);
      ws.terminate();
      resolve(true);
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

module.exports = { isRelayAvailable };