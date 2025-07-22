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

function getTunnelFile(name, type = 'expose', port = null) {
  let filename = sanitizeFileName(name);
  if (type === 'connect' && port !== null) {
    filename = `connect-${filename}-${port}`;
  } else if (type === 'expose') {
    filename = `expose-${filename}`;
  }
  return path.join(PID_DIR, `${filename}.json`);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isPortAvailable(port) {
  if (!port) return;

  return new Promise((resolve) => {
    const tester = require('net').createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function startTunnel(scriptPath, args, name, type, port = null) {
  if (type == "connect" && !(await isPortAvailable(port))) {
    console.error(`⚠️ La porta ${port} è occupata!`);
    return;
  }

  const file = getTunnelFile(name, type, port);

  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isProcessAlive(existing.pid)) {
      const label = type === 'connect' ? `porta ${port}` : '';
      console.log(`⚠️ Tunnel '${name}' [${type}] ${label} è già attivo (PID ${existing.pid})`);
      return;
    } else {
      fs.unlinkSync(file); // Pulisce PID morto
    }
  }

  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();

  const tunnelData = {
    pid: child.pid,
    type,
    ...(port ? { port } : {})
  };

  fs.writeFileSync(file, JSON.stringify(tunnelData, null, 2));

  const label = type === 'connect'
    ? `🔗 Connessione a '${name}' effettuata sulla porta ${port}`
    : `🚀 Tunnel '${name}' esposto`;

  console.log(`${label} (PID ${child.pid})`);
}

function stopTunnel(name) {
  const file = getTunnelFile(name, 'expose');
  if (!fs.existsSync(file)) {
    console.log(`❌ Nessun tunnel expose con nome '${name}'`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (isProcessAlive(data.pid)) {
    try {
      process.kill(data.pid);
      console.log(`🛑 Tunnel expose '${name}' terminato (PID ${data.pid})`);
    } catch (err) {
      console.error(`⚠️ Errore nel terminare '${name}': ${err.message}`);
    }
  } else {
    console.log(`⚠️ Processo expose '${name}' già terminato`);
  }

  fs.unlinkSync(file);
}

function stopConnection(name, port) {
  const file = getTunnelFile(name, 'connect', port);
  if (!fs.existsSync(file)) {
    console.log(`❌ Nessuna connessione '${name}' sulla porta ${port}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (isProcessAlive(data.pid)) {
    try {
      process.kill(data.pid);
      console.log(`🛑 Connessione '${name}' su porta ${port} terminata (PID ${data.pid})`);
    } catch (err) {
      console.error(`⚠️ Errore nel terminare la connessione: ${err.message}`);
    }
  } else {
    console.log(`⚠️ Processo connessione '${name}' su porta ${port} già terminato`);
  }

  fs.unlinkSync(file);
}

function listTunnels() {
  if (!fs.existsSync(PID_DIR)) return console.log('Nessun tunnel attivo.');

  const files = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) return console.log('Nessun tunnel attivo.');

  console.log('🌐 Tunnel attivi:');
  for (const file of files) {
    const fullPath = path.join(PID_DIR, file);
    let data;

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.trim()) {
        console.log(`⚠️ File vuoto: ${file}`);
        continue;
      }

      data = JSON.parse(content);
      if (!data || typeof data.pid !== 'number') {
        console.log(`⚠️ File invalido o mancante PID: ${file}`);
        continue;
      }
    } catch (err) {
      console.log(`⚠️ Errore nel parsing JSON (${file}): ${err.message}`);
      continue;
    }

    const alive = isProcessAlive(data.pid);
    const icon = alive ? '✅' : '❌';
    const label = data.type === 'connect'
      ? `📥 connect → ${data.port}`
      : '📤 expose';

    const name = path.basename(file, '.json')
      .replace(/^connect-/, '')
      .replace(/^expose-/, '')
      .replace(/-\d+$/, '');

    console.log(`- ${label} '${name}' (PID ${data.pid}) ${icon}`);
  }
}

function checkTunnel(name) {
  const file = getTunnelFile(name, 'expose');
  if (!fs.existsSync(file)) {
    console.log(`❌ Nessun tunnel expose con nome '${name}'`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (isProcessAlive(data.pid)) {
    console.log(`✅ Tunnel expose '${name}' è attivo (PID ${data.pid})`);
  } else {
    console.log(`❌ Tunnel expose '${name}' non è attivo. Verrà rimosso.`);
    fs.unlinkSync(file);
  }
}

function checkConnection(name, port) {
  const file = getTunnelFile(name, 'connect', port);
  if (!fs.existsSync(file)) {
    console.log(`❌ Nessuna connessione '${name}' sulla porta ${port}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (isProcessAlive(data.pid)) {
    console.log(`✅ Connessione '${name}' su porta ${port} è attiva (PID ${data.pid})`);
  } else {
    console.log(`❌ Connessione '${name}' su porta ${port} non è attiva. Verrà rimossa.`);
    fs.unlinkSync(file);
  }
}

module.exports = {
  startTunnel,
  stopTunnel,
  stopConnection,
  listTunnels,
  checkTunnel,
  checkConnection,
};