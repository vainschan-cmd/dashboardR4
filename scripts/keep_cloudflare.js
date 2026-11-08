const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const urlFile = path.join(__dirname, '../TUNNEL_URL.txt');
const binaryPath = path.join(__dirname, '../cloudflared');

function runTunnel() {
  console.log('[Cloudflare Watcher] Memulai cloudflared tunnel...');
  const child = spawn(binaryPath, ['tunnel', '--url', 'http://localhost:3000']);

  let currentUrl = '';

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/);
    if (match && match[0] && match[0] !== currentUrl) {
      currentUrl = match[0];
      fs.writeFileSync(urlFile, currentUrl + '\n');
      console.log(`[Cloudflare Watcher] Tunnel Aktif: ${currentUrl}`);
    }

    if (text.includes('Unauthorized: Tunnel not found') || text.includes('failed to request quick Tunnel')) {
      console.log('[Cloudflare Watcher] Sesi tunnel habis atau error server side. Merestart...');
      try { child.kill('SIGTERM'); } catch (e) {}
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('close', (code) => {
    console.log(`[Cloudflare Watcher] Cloudflared exit code: ${code}. Spawn ulang dalam 3 detik...`);
    setTimeout(runTunnel, 3000);
  });
}

runTunnel();

