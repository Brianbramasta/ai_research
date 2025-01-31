/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'export'
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "fs": false,
      "path": false,
    };
    return config;
  },
};

module.exports = nextConfig;