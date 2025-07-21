const WebSocket = require('ws');
const { log } = require('../utils/log');

function setupWebSocket(url) {
  const ws = new WebSocket(url);

  ws.on('open', () => log('WebSocket connesso a', url));
  ws.on('error', err => console.error('[WebSocket]', err.message));
  ws.on('close', () => log('WebSocket chiuso'));

  return ws;
}

module.exports = { setupWebSocket };
