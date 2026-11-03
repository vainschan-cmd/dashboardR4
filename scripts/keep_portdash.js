const localtunnel = require('/Users/chandra/.npm/_npx/75ac80b86e83d4a2/node_modules/localtunnel');

async function keepPortdashAlive() {
  console.log('[Tunnel Watcher] Memulai watcher khusus https://portdash-r4.loca.lt...');

  while (true) {
    try {
      const tunnel = await localtunnel({ port: 3000, subdomain: 'portdash-r4' });

      if (tunnel.url === 'https://portdash-r4.loca.lt') {
        console.log(`[Tunnel Watcher] BERHASIL! Terhubung ke ${tunnel.url}`);

        await new Promise((resolve) => {
          tunnel.on('close', () => {
            console.log('[Tunnel Watcher] Tunnel ditutup oleh server, mencoba menghubungkan kembali...');
            resolve();
          });
          tunnel.on('error', (err) => {
            console.log('[Tunnel Watcher] Error:', err.message);
            try { tunnel.close(); } catch (e) {}
            resolve();
          });
        });
      } else {
        console.log(`[Tunnel Watcher] Subdomain portdash-r4 sedang dilepas oleh server loca.lt (mendapat: ${tunnel.url}). Menunggu 3 detik...`);
        try { tunnel.close(); } catch (e) {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.log(`[Tunnel Watcher] Gagal menghubungi server: ${err.message}. Mencoba lagi dalam 4 detik...`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

keepPortdashAlive();
