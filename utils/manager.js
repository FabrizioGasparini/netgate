const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PID_DIR = path.join(os.homedir(), '.netgate/pids');
if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true });

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+$/, '')
    .replace(/\.+$/, '')
    .slice(0, 255);
}

function getTunnelFile(name, connect = false) {
  return path.join(PID_DIR, `${connect ? "connect-" : ""}${sanitizeFileName(name)}.json`);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startTunnel(scriptPath, args, name, type, port = null) {
  const file = getTunnelFile(name);
  let data = null;

  // Se è un expose
  if (type === 'expose') {
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (isProcessAlive(data.pid)) {
        console.log(`⚠️ Tunnel '${name}' [expose] è già attivo (PID ${data.pid})`);
        return;
      } else {
        fs.unlinkSync(file); // Cleanup vecchio
      }
    }

    const child = spawn(process.execPath, [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    const tunnelData = {
      pid: child.pid,
      type: 'expose',
      connections: [],
    };

    fs.writeFileSync(file, JSON.stringify(tunnelData, null, 2));
    console.log(`🚀 Tunnel '${name}' [expose] avviato (PID ${child.pid})`);
  }

  // Se è un connect
  else if (type === 'connect') {
    /*if (!fs.existsSync(file)) {
      console.log(`❌ Nessun tunnel 'expose' attivo con nome '${name}'`);
      return;
    }

    data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.type !== 'expose' || !isProcessAlive(data.pid)) {
      console.log(`❌ Tunnel '${name}' non è un 'expose' attivo.`);
      return;
    }

    // Controlla se la porta è già usata
    if (data.connections.some(conn => conn.port === port)) {
      console.log(`⚠️ La porta ${port} è già usata per il tunnel '${name}'.`);
      return;
    }*/

    const child = spawn(process.execPath, [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    //data.connections.push({ pid: child.pid, port });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`🔗 Connessione a '${name}' effettuata sulla porta ${port} (PID ${child.pid})`);
  }
}

function stopTunnel(name) {
  const file = getTunnelFile(name);
  if (!fs.existsSync(file)) {
    console.log(`❌ Nessun tunnel attivo con nome '${name}'`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Stop expose
  if (isProcessAlive(data.pid)) {
    try {
      process.kill(data.pid);
    } catch { }
  }

  // Stop connects
  for (const conn of data.connections) {
    if (isProcessAlive(conn.pid)) {
      try {
        process.kill(conn.pid);
      } catch { }
    }
  }

  fs.unlinkSync(file);
  console.log(`🛑 Tunnel '${name}' arrestato e tutte le connessioni chiuse.`);
}

function listTunnels() {
  if (!fs.existsSync(PID_DIR)) return console.log('Nessun tunnel attivo.');

  const files = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return console.log('Nessun tunnel attivo.');

  console.log('🌐 Tunnel attivi:');
  console.log(files)
  for (const file of files) {
    const name = path.basename(file, '.json');
    const fullPath = path.join(PID_DIR, file);
    let data;

    try {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      console.log(`⚠️ File corrotto: ${file}`);
      continue;
    }

    const exposeAlive = isProcessAlive(data.pid);
    const exposeStatus = exposeAlive ? '' : '⚠️ non attivo';

    console.log(`📤 ${name} [expose] (PID ${data.pid}) ${exposeStatus}`);

    for (const conn of data.connections) {
      const alive = isProcessAlive(conn.pid);
      const icon = alive ? '📥' : '⚠️';
      const info = alive ? `(PID ${conn.pid})` : '(non attivo)';
      console.log(`   └── ${icon} Porta ${conn.port} ${info}`);
    }
  }
}

function stopConnection(name, port) {
  const filePath = getTunnelFile(name, true);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Nessun tunnel '${name}' trovato.`);
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.type !== 'expose') {
      console.log(`⚠️ Il tunnel '${name}' non è di tipo 'expose'.`);
      return;
    }

    const connections = data.connections || [];
    const index = connections.findIndex(c => c.port === port);
    if (index !== -1) {
      const conn = connections[index];
      try {
        process.kill(conn.pid);
        connections.splice(index, 1);
        fs.writeFileSync(filePath, JSON.stringify({ ...data, connections }, null, 2));
        console.log(`❌ Connessione sulla porta ${port} terminata (PID ${conn.pid})`);
        return;
      } catch (err) {
        console.error(`⚠️ Errore nel terminare la connessione su porta ${port}: ${err.message}`);
        return;
      }
    } else {
      console.log(`🔍 Nessuna connessione trovata sulla porta ${port} per il tunnel '${name}'`);
    }
  } catch (err) {
    console.error(`⚠️ Errore nel leggere il file PID per '${name}': ${err.message}`);
  }
}


module.exports = {
  startTunnel,
  stopTunnel,
  stopConnection,
  listTunnels,
};
