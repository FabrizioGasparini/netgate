#!/usr/bin/env node

const { argv } = require('process');
const { expose } = require('./core/expose');
const { connect } = require('./core/connect');
const { startRelayServer } = require('./relay/server');
const { log } = require('./utils/log');

const [, , command, ...args] = argv;

(async () => {
  switch (command) {
    case 'expose': {
      const port = parseInt(args[0]);
      const name = args.length == 2 ? args[1] : Date.now().toString() + Math.random().toString(36).slice(2);
      if (!port || !name) {
        console.log('❌ Uso: netgate expose <porta> <nome>');
        return;
      }
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : undefined;
      await expose(port, name, relay);
      break;
    }

    case 'connect': {
      const target = args[0];
      const bindPort = parseInt(args[1]);
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : undefined;
      if (!target) {
        console.log('❌ Uso: netgate connect <nome-target> <porta-locale>');
        return;
      }

      await connect(target, bindPort, relay);
      break;
    }

    case 'relay': {
      startRelayServer(8080);
      break;
    }

    default:
      console.log('Comandi disponibili:');
      console.log('  expose <porta> --as <nome>');
      console.log('  connect <nome-target>');
      console.log('  relay');
      break;
  }
})();