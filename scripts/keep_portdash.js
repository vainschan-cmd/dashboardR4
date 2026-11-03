const localtunnel = require('/Users/chandra/.npm/_npx/75ac80b86e83d4a2/node_modules/localtunnel');

// Keep event loop active permanently so process never exits
setInterval(() => {}, 10000);

async function keepPortdashAlive() {
  console.log('[Tunnel Watcher] Memulai watcher khusus https://portdash-r4.loca.lt...');

  while (true) {
    let tunnelInstance = null;
    try {
      tunnelInstance = await localtunnel({ port: 3000, subdomain: 'portdash-r4' });

      if (tunnelInstance.url === 'https://portdash-r4.loca.lt') {
        console.log(`[Tunnel Watcher] BERHASIL! Terhubung ke ${tunnelInstance.url}`);

        await new Promise((resolve) => {
          let resolved = false;
          const finish = (reason) => {
            if (!resolved) {
              resolved = true;
              console.log(`[Tunnel Watcher] Trigger reconnect (${reason})`);
              try { tunnelInstance.close(); } catch (e) {}
              resolve();
            }
          };

          tunnelInstance.on('close', () => finish('tunnel closed'));
          tunnelInstance.on('error', (err) => finish(`tunnel error: ${err.message}`));
          if (tunnelInstance.tunnelCluster) {
            tunnelInstance.tunnelCluster.on('error', (err) => finish(`cluster error: ${err.message}`));
          }
        });
      } else {
        console.log(`[Tunnel Watcher] Mendapat ${tunnelInstance.url} (bukan portdash-r4). Menunggu 3 detik...`);
        try { tunnelInstance.close(); } catch (e) {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.log(`[Tunnel Watcher] Error koneksi: ${err.message}. Mencoba lagi dalam 3 detik...`);
      try { if (tunnelInstance) tunnelInstance.close(); } catch (e) {}
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

keepPortdashAlive().catch((err) => {
  console.error('[Tunnel Watcher] Fatal error:', err);
  process.exit(1);
});
