import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.1.10',
    '192.168.1.*',
    'localhost',
    '*.local',
    '*.trycloudflare.com',
    'improved-populations-diane-least.trycloudflare.com',
    'grow-waiting-edited-innocent.trycloudflare.com',
    '*.loca.lt',
  ],
};

export default nextConfig;
