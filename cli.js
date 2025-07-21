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
      const name = args.includes('--as') ? args[args.indexOf('--as') + 1] : '';
      if (!port || !name) {
        console.log('❌ Uso: node cli.js expose <porta> --as <nome>');
        return;
      }
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : '';
      await expose(port, name, relay);
      break;
    }

    case 'connect': {
      const target = args[0];
      if (!target) {
        console.log('❌ Uso: node cli.js connect <nome-target>');
        return;
      }
      await connect(target);
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