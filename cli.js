#!/usr/bin/env node

const { argv } = require('process');
const {
  startTunnel,
  stopTunnel,
  stopConnection,
  listTunnels,
  checkTunnel,
  checkConnection
} = require('./utils/manager');

const [, , command, subcommand, ...args] = argv;

const RELAY_DEFAULT = 'ws://netgate.gh3sp.com:8080';

(async () => {
  switch (command) {
    case 'expose': {
      if (subcommand === 'stop') {
        stopTunnel(args[0]);
        break;
      }

      if (subcommand === 'check') {
        checkTunnel(args[0]);
        break;
      }

      const port = parseInt(subcommand);
      const name = args[0];
      const relay = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : RELAY_DEFAULT;
      if (!port || !name) {
        console.log('❌ Uso: netgate expose <porta> <nome> [--relay <url>]');
        return;
      }

      startTunnel(require.resolve('./core/expose.js'), ["expose", port, name, relay], name, 'expose');
      break;
    }

    case 'connect': {
      if (subcommand === 'stop') {
        if (!args[0] || !args[1]) {
          console.log('❌ Uso: netgate connect stop <nome-target> <porta-locale>');
          return;
        }
        stopConnection(args[0], args[1]);
        break;
      }

      if (subcommand === 'check') {
        if (!args[0] || !args[1]) {
          console.log('❌ Uso: netgate connect check <nome-target> <porta-locale>');
          return;
        }
        checkConnection(args[0], args[1]);
        break;
      }

      const target = subcommand;
      const bindPort = parseInt(args[0]);
      const relayC = args.includes('--relay') ? args[args.indexOf('--relay') + 1] : RELAY_DEFAULT;

      if (!target || !bindPort) {
        console.log('❌ Uso: netgate connect <nome-target> <porta-locale> [--relay <url>]');
        return;
      }

      startTunnel(require.resolve('./core/connect.js'), ["connect", target, bindPort, relayC], target, 'connect', bindPort);
      break;
    }

    case 'list': {
      listTunnels();
      break;
    }

    case 'relay': {
      const relayPort = parseInt(subcommand) || 8080;
      require('./relay/server.js').startRelayServer(relayPort);
      break;
    }

    default: {
      console.log('Comandi disponibili:');
      console.log('  netgate expose <porta> <nome> [--relay <url>]');
      console.log('  netgate expose stop <nome>');
      console.log('  netgate expose check <nome>');
      console.log('  netgate connect <nome-target> <porta-locale> [--relay <url>]');
      console.log('  netgate connect stop <nome-target> <porta-locale>');
      console.log('  netgate connect check <nome-target> <porta-locale>');
      console.log('  netgate list');
      console.log('  netgate relay [porta]');
      break;
    }
  }
})();