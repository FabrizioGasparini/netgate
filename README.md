# Gh3NetGate

🛰️ **Gh3NetGate** è un tunnel P2P crittografato, che ti permette di esporre porte TCP (come SSH) da una macchina A a una macchina B tramite un relay WebSocket, senza dover configurare firewall, NAT o IP pubblico.

## 🚀 Funzionalità

- Espone porte TCP tramite WebSocket Relay
- Tunnel criptato con `tweetnacl`
- Connessioni peer-to-peer multiple
- CLI globale: `netgate` da qualsiasi terminale
- Leggerissimo, scritto in Node.js

## 🔧 Installazione da sorgente (dev)

```bash
git clone https://github.com/<tuo-utente>/gh3netgate
cd gh3netgate
npm install
npm link    # ✅ Rende 'netgate' disponibile globalmente
```

Ora puoi usare il comando `netgate` ovunque!

## 🧪 Esempi d’uso

### Avvia il relay (su server pubblico o locale)

```bash
netgate relay [porta]
# Default: 8080
```

### Esporre una porta (es. SSH)

```bash
netgate expose 22 fabri --relay gh3sp.com --port 8080
```

### Collegarsi al server remoto esposto

```bash
netgate connect fabri 2222 --relay gh3sp.com --port 8080
ssh utente@localhost -p 2222
```

## 🗂️ Struttura del progetto

```
gh3netgate/
├── cli.js             # Entry point CLI
├── core/              # Codice per expose & connect
├── relay/             # Relay server WebSocket
├── utils/             # Logger e chiavi
├── websocket.js       # Setup WebSocket
├── keys/              # Gestione chiavi
├── package.json
```

## 🧪 Build binario

Per creare un eseguibile standalone:

```bash
npm install -g pkg
pkg .
```

## 📃 Licenza

MIT © 2025 Fabri — https://gh3sp.com
