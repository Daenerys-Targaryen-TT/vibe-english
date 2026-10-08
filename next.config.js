/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const basePath = '/vibe-english';

const nextConfig = {
  output: 'export',
  basePath: isProd ? basePath : '',
  assetPrefix: isProd ? basePath + '/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? basePath : '',
  },
};

module.exports = nextConfig;
