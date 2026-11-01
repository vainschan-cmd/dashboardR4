import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    '192.168.1.10',
    '192.168.1.*',
    'localhost',
    '*.local',
    '*.trycloudflare.com',
    '*.loca.lt',
  ],
};

export default nextConfig;
