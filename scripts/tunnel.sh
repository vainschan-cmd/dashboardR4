#!/bin/bash
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Memulai localtunnel portdash-r4..."
  npx -y localtunnel --port 3000 --subdomain portdash-r4
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Localtunnel terputus, menghubungkan ulang dalam 2 detik..."
  sleep 2
done
