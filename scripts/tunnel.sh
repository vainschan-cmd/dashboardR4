#!/bin/bash
# SA-27: Unpinned remote localtunnel execution on a predictable public subdomain
# has been removed to eliminate supply-chain and unintended public exposure risks.
# Use an authenticated Cloudflare Tunnel instead:
#   CLOUDFLARE_TUNNEL_TOKEN=<token> npm run tunnel:cloudflare
echo "Error: scripts/tunnel.sh (localtunnel) dinonaktifkan demi keamanan. Gunakan 'npm run tunnel:cloudflare' dengan TUNNEL_TOKEN." >&2
exit 1

