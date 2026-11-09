let localtunnel;
try {
  localtunnel = require('localtunnel');
} catch {
  console.error('[Tunnel Watcher] Paket "localtunnel" belum terpasang. Jalankan "npm install -D localtunnel" terlebih dahulu.');
  process.exit(1);
}

const PORT = Number(process.env.PORT || 3000);
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'portdash-r4';
const EXPECTED_URL = `https://${SUBDOMAIN}.loca.lt`;

// Keep event loop active permanently so process never exits
setInterval(() => {}, 10000);

async function keepPortdashAlive() {
  console.log(`[Tunnel Watcher] Memulai pemantau tunnel untuk ${EXPECTED_URL}...`);

  while (true) {
    let tunnelInstance = null;
    try {
      tunnelInstance = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });

      if (tunnelInstance.url === EXPECTED_URL) {
        console.log(`[Tunnel Watcher] Terhubung ke ${tunnelInstance.url}`);

        await new Promise((resolve) => {
          let resolved = false;
          const finish = (reason) => {
            if (!resolved) {
              resolved = true;
              console.log(`[Tunnel Watcher] Memicu sambungan ulang (${reason})`);
              try {
                tunnelInstance.close();
              } catch (e) {
                console.warn('[Tunnel Watcher] Gagal menutup instance tunnel:', e);
              }
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
        console.log(`[Tunnel Watcher] Menerima ${tunnelInstance.url} (bukan ${SUBDOMAIN}). Menunggu 3 detik...`);
        try {
          tunnelInstance.close();
        } catch (e) {
          console.warn('[Tunnel Watcher] Gagal menutup instance tunnel sementara:', e);
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.log(`[Tunnel Watcher] Gangguan koneksi: ${err.message}. Mencoba kembali dalam 3 detik...`);
      try {
        if (tunnelInstance) tunnelInstance.close();
      } catch (e) {
        console.warn('[Tunnel Watcher] Gagal membersihkan koneksi gagal:', e);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

keepPortdashAlive().catch((err) => {
  console.error('[Tunnel Watcher] Kesalahan fatal:', err);
  process.exit(1);
});
