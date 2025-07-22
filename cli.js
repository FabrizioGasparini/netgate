#!/usr/bin/env node

const { argv } = require('process');
const { expose } = require('./core/expose');
const { connect } = require('./core/connect');
const { startRelayServer } = require('./relay/server');
const { log } = require('./utils/log');

const [, , command, ...args] = argv;

const usage = () => {
  console.log('\n🌐  Gh3NetGate - Remote Secure Tunnel');
  console.log('-----------------------------------');
  console.log('📦 Comandi disponibili:');
  console.log('');
  console.log('🔓  expose <porta-locale> <nome> [--relay <url>]');
  console.log('     ↪ Espone una porta locale su Internet, accessibile da altri client.');
  console.log('');
  console.log('🔗  connect <nome-target> <porta-locale> [--relay <url>]');
  console.log('     ↪ Si connette a un server esposto con il nome specificato.');
  console.log('');
  console.log('📡  relay [porta]');
  console.log('     ↪ Avvia il server relay WebSocket sulla porta specificata (default: 8080).\n');
  console.log('');
  console.log('ℹ️  Esempio:');
  console.log('     netgate expose 22 fabri --relay ws://netgate.gh3sp.com:8080');
  console.log('     netgate connect fabri 2222');
  console.log('     netgate relay 1234\n');
  console.log('');
};

(async () => {
  switch (command) {
    case 'expose': {
      const port = parseInt(args[0]);
      const name = args[1] || `srv-${Date.now().toString(36)}`;
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : 'ws://netgate.gh3sp.com:8080';

      if (!port) {
        console.log('❌ Errore: devi specificare una porta da esporre.');
        usage();
        return;
      }

      log(`🚪 Espongo la porta ${port} come '${name}'`);
      log(`🔁 Relay usato: ${relay}`);
      await expose(port, name, relay);
      break;
    }

    case 'connect': {
      const target = args[0];
      const bindPort = parseInt(args[1]);
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : 'ws://netgate.gh3sp.com:8080';

      if (!target || !bindPort) {
        console.log('❌ Errore: devi specificare un target e una porta di bind.');
        usage();
        return;
      }

      log(`🔗 Mi connetto al target '${target}' e inoltro su porta locale ${bindPort}`);
      log(`🔁 Relay usato: ${relay}`);
      await connect(target, bindPort, relay);
      break;
    }

    case 'relay': {
      const relayPort = parseInt(args[0]) || 8080;
      log(`📡 Avvio del server relay WebSocket sulla porta ${relayPort}`);
      startRelayServer(relayPort);
      break;
    }

    default:
      usage();
      break;
  }
})();
