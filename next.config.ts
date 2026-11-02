import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    '192.168.29.167',
    '192.168.29.167:3000',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
