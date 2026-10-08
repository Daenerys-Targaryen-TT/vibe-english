/** @type {import('next').NextConfig} */
// basePath 通过环境变量控制：默认空（适配 Cloudflare Pages / Vercel 根路径部署）。
// 若部署到 GitHub Pages 子路径，构建时设置 NEXT_PUBLIC_BASE_PATH=/vibe-english
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? basePath + "/" : "",
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
